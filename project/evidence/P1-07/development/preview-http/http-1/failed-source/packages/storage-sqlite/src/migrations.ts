import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, existsSync, realpathSync, statSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StorageError } from './errors.js';

export interface Migration { version: number; name: string; sha256: string; sql: string }
export const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export function readMigrations(directory = fileURLToPath(new URL('./migrations/', import.meta.url))): Migration[] {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8')) as { version: number; name: string; sha256: string }[];
  return manifest.map((entry, index) => {
    if (entry.version !== index + 1 || !/^\d{4}-[a-z]+\.sql$/.test(entry.name)) throw new StorageError('MIGRATION_MANIFEST_INVALID', 500, 'Migration versions/names are invalid');
    const sql = readFileSync(resolve(directory, entry.name), 'utf8');
    if (digest(sql) !== entry.sha256) throw new StorageError('MIGRATION_CHECKSUM_MISMATCH', 500, `Migration content changed: ${entry.name}`);
    return { ...entry, sql };
  });
}
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = fn();
    if (value && typeof (value as { then?: unknown }).then === 'function') throw new StorageError('ASYNC_TRANSACTION_FORBIDDEN', 500, 'Transactions cannot await');
    db.exec('COMMIT');
    return value;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}
export function checkHistory(db: DatabaseSync, migrations: readonly Migration[]): number {
  const hasHistory = db.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").get();
  if (!hasHistory) {
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get()) throw new StorageError('DATABASE_UNRECOGNIZED', 409, 'Refusing an unrecognized database');
    return 0;
  }
  const rows = db.prepare('SELECT version,name,sha256 FROM schema_migrations ORDER BY version').all();
  for (const [index, row] of rows.entries()) {
    const expected = migrations[index];
    if (!expected || row.version !== expected.version || row.name !== expected.name || row.sha256 !== expected.sha256) throw new StorageError('MIGRATION_HISTORY_MISMATCH', 409, 'Unknown, non-contiguous or changed migration history');
  }
  if (!rows.length) throw new StorageError('MIGRATION_HISTORY_MISMATCH', 409, 'Uncommitted/empty migration history');
  if (db.prepare('PRAGMA user_version').get()?.user_version !== rows.length) throw new StorageError('MIGRATION_HISTORY_MISMATCH', 409, 'SQLite version marker differs from migration history');
  return rows.length;
}
export function applyMigrations(db: DatabaseSync, migrations: readonly Migration[], storeId: string, layoutVersion = 1, targetVersion = migrations.length): number {
  let version = checkHistory(db, migrations);
  if (!Number.isInteger(targetVersion) || targetVersion < version || targetVersion < 1 || targetVersion > migrations.length) throw new StorageError('MIGRATION_DOWNGRADE_FORBIDDEN', 409, 'Unsupported migration target');
  if (version > 0) {
    const identity = db.prepare('SELECT store_id,layout_version FROM store_metadata WHERE singleton_id=1').get();
    if (identity?.store_id !== storeId || identity.layout_version !== layoutVersion) throw new StorageError('STORE_IDENTITY_MISMATCH', 409, 'storeId/layoutVersion does not match');
  }
  for (const migration of migrations.slice(version, targetVersion)) {
    transaction(db, () => {
      if (version === 0) db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL) STRICT;');
      db.exec(migration.sql);
      if (version === 0) db.prepare('INSERT INTO store_metadata VALUES(1,?,?,?)').run(storeId, layoutVersion, new Date().toISOString());
      if (db.prepare('PRAGMA foreign_key_check').get()) throw new StorageError('MIGRATION_FOREIGN_KEY_FAILURE', 409, 'Migration left invalid foreign keys');
      db.prepare('INSERT INTO schema_migrations VALUES(?,?,?,?)').run(migration.version, migration.name, migration.sha256, new Date().toISOString());
      db.exec(`PRAGMA user_version=${migration.version}`);
    });
    version = migration.version;
  }
  return version;
}
export async function backupBeforeUpgrade(db: DatabaseSync, databasePath: string, backupDirectory: string | undefined): Promise<string> {
  if (!backupDirectory || !isAbsolute(backupDirectory) || !existsSync(backupDirectory) || !statSync(backupDirectory).isDirectory()) throw new StorageError('UPGRADE_BACKUP_REQUIRED', 409, 'Provide an existing absolute backup directory');
  const base = realpathSync(dirname(databasePath)), target = realpathSync(backupDirectory);
  const rel = relative(base, target);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) throw new StorageError('BACKUP_PATH_OVERLAP', 409, 'Backup must be outside the database directory');
  const path = resolve(target, `devmesh-${Date.now()}-${randomUUID()}.sqlite`);
  await backup(db, path);
  const copy = new DatabaseSync(path);
  try {
    // The exported backup must be a standalone file, including after a WAL source.
    copy.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
    if (copy.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok' || copy.prepare('PRAGMA foreign_key_check').get()) throw new StorageError('BACKUP_INVALID', 500, 'Backup integrity check failed');
  } finally { copy.close(); }
  return path;
}
