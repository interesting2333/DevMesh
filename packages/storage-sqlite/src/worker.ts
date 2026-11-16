import { parentPort, workerData, threadId } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { requests } from './protocol.js';
import type { Method } from './protocol.js';
import { createDomain } from './domain.js';
import { applyMigrations, backupBeforeUpgrade, checkHistory, readMigrations } from './migrations.js';
import { failure, StorageError } from './errors.js';

const port = parentPort;
if (!port) throw new Error('Storage entry must run in its Worker');
let db: DatabaseSync | undefined;
try {
  const options = z.strictObject({ databasePath: z.string(), storeId: z.uuid(), layoutVersion: z.literal(1).default(1), create: z.boolean().default(false), backupDirectory: z.string().optional(), targetVersion: z.number().int().positive().optional(), queueCapacity: z.number().optional(), recoveryToken: z.string().optional() }).parse(workerData);
  const existed = existsSync(options.databasePath);
  if (options.create && existed) throw new StorageError('DATABASE_ALREADY_EXISTS', 409, 'Explicit creation cannot overwrite an existing file');
  if (!existed && !options.create) throw new StorageError('DATABASE_NOT_FOUND', 404, 'Database creation must be explicit');
  if (existed && statSync(options.databasePath).size === 0) throw new StorageError('DATABASE_UNRECOGNIZED', 409, 'Refusing an uninitialized existing database');
  db = new DatabaseSync(options.databasePath, { enableForeignKeyConstraints: true, enableDoubleQuotedStringLiterals: false, allowExtension: false });
  const migrations = readMigrations(fileURLToPath(new URL('./migrations/', import.meta.url)));
  const version = checkHistory(db, migrations);
  if (existed && version === 0) throw new StorageError('DATABASE_UNRECOGNIZED', 409, 'An existing database has no committed DevMesh identity');
  if (version > 0) {
    const identity = db.prepare('SELECT store_id,layout_version FROM store_metadata WHERE singleton_id=1').get();
    if (identity?.store_id !== options.storeId || identity.layout_version !== options.layoutVersion) throw new StorageError('STORE_IDENTITY_MISMATCH', 409, 'Configured store identity differs from the database');
  }
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  let backupPath: string | null = null;
  const target = options.targetVersion ?? migrations.length;
  if (existed && version < target) backupPath = await backupBeforeUpgrade(db, options.databasePath, options.backupDirectory);
  const installedVersion = applyMigrations(db, migrations, options.storeId, options.layoutVersion, target);
  if (db.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').get()) throw new StorageError('DATABASE_INTEGRITY_FAILURE', 500, 'Database integrity check failed');
  const domain = createDomain(db);
  const lastEvent=()=>String(db!.prepare('SELECT event_id FROM events ORDER BY rowid DESC LIMIT 1').get()?.event_id??'');
  let notifiedEvent=installedVersion===migrations.length?lastEvent():null;
  port.on('message', (message: { id: number; method: string; payload: unknown }) => {
    try {
      if (!Number.isSafeInteger(message.id)) throw new StorageError('RPC_INVALID', 422, 'Request id is invalid');
      if (message.method === 'close' && message.id === -1) { db!.close(); port.postMessage({ id: -1, value: null }); port.close(); return; }
      if (!Object.hasOwn(requests, message.method)) throw new StorageError('METHOD_NOT_ALLOWED', 422, 'Arbitrary SQL or closures are not supported');
      if (Buffer.byteLength(JSON.stringify(message.payload), 'utf8') > 256 * 1024) throw new StorageError('REQUEST_TOO_LARGE', 413, 'Storage RPC is limited to 256 KiB');
      let value: unknown;
      if (message.method === 'inspect') {
        requests.inspect.parse(message.payload);
        const names = db!.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
        value = { version: installedVersion, storeId: options.storeId, layoutVersion: options.layoutVersion, workerThreadId: threadId, sqliteVersion: db!.prepare('SELECT sqlite_version() v').get()!.v, pragmas: Object.fromEntries(['journal_mode','foreign_keys','synchronous','busy_timeout'].map(key => [key, Object.values(db!.prepare(`PRAGMA ${key}`).get()!)[0]])), counts: Object.fromEntries(names.map(row => [row.name, db!.prepare(`SELECT count(*) n FROM "${String(row.name).replaceAll('"','""')}"`).get()!.n])), backupPath, foreignKeyErrors: db!.prepare('PRAGMA foreign_key_check').all() };
      } else {
        if (installedVersion !== migrations.length) throw new StorageError('SCHEMA_UPGRADE_REQUIRED', 503, 'Partial migration targets only allow inspection');
        value = domain.execute(message.method as Method, message.payload);
      }
      port.postMessage({ id: message.id, value });
    } catch (error) {
      port.postMessage({ id: message.id, error: error instanceof z.ZodError ? { code: 'SCHEMA_INVALID', status: 422, message: 'Invalid storage request', details: { issues: error.issues } } : failure(error) });
      if (message.method === 'close' && message.id === -1) port.close();
    } finally {
      // Hints follow committed transactions; actual protected replay reads remain authoritative.
      if(installedVersion===migrations.length&&db!.isOpen&&!db!.isTransaction){const latest=lastEvent();if(latest!==notifiedEvent){notifiedEvent=latest;port.postMessage({type:'event-commit'});}}
    }
  });
  port.postMessage({ type: 'ready' });
} catch (error) {
  if (db?.isOpen) db.close();
  port.postMessage({ id: 0, error: failure(error) });
  port.close();
}
