import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, linkSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { TaskDatabase } from '../src/server/database.js';
import { canonicalDataset, checkedFile, loadDataset } from '../src/server/dataset.js';
import { TaskInput } from '../src/shared/task.js';
const roots: string[] = [];
const stores: TaskDatabase[] = [];
function root() { const parent = mkdtempSync(join(tmpdir(), 'devmesh-template-db-')); roots.push(parent); return join(parent, 'dataset'); }
function dataset(readOnly = false) { const path = root(); TaskDatabase.initialize(path); const database = new TaskDatabase(path, readOnly); stores.push(database); return { path, database }; }
const input = { title: '任务一', description: '需要持久化', status: 'todo' as const };
afterEach(() => { for (const database of stores.splice(0)) database.close(); for (const parent of roots.splice(0)) rmSync(parent, { recursive: true, force: true }); });
describe('dataset and durable CRUD', () => {
  it('persists creates, versioned state updates and receipt replay across restart', () => {
    const { path, database } = dataset();
    const key = randomUUID();
    const created = database.mutate({ kind: 'create', key, input });
    expect(created.task?.revision).toBe(1);
    expect(database.mutate({ kind: 'create', key, input })).toEqual(created);
    expect(database.list().tasks).toHaveLength(1);
    expect(() => database.mutate({ kind: 'create', key, input: { ...input, title: '不同请求' } })).toThrow('IDEMPOTENCY_CONFLICT');
    const task = created.task!;
    const updated = database.mutate({ kind: 'update', key: randomUUID(), id: task.id, revision: 1, input: { ...input, status: 'doing' } });
    expect(updated.task?.revision).toBe(2);
    expect(() => database.mutate({ kind: 'update', key: randomUUID(), id: task.id, revision: 1, input })).toThrow('REVISION_CONFLICT');
    database.close();
    const restarted = new TaskDatabase(path); stores.push(restarted);
    expect(restarted.list().tasks[0]?.status).toBe('doing');
    expect(restarted.mutate({ kind: 'create', key, input })).toEqual(created);
    const deletion = { kind: 'delete' as const, key: randomUUID(), id: task.id, revision: 2 };
    expect(restarted.mutate(deletion)).toEqual({ status: 200, task: null });
    expect(restarted.mutate(deletion)).toEqual({ status: 200, task: null });
    expect(restarted.list().tasks).toEqual([]);
    expect(() => restarted.mutate({ ...deletion, key: randomUUID() })).toThrow('TASK_NOT_FOUND');
    restarted.close(); restarted.close();
    expect(() => restarted.list()).toThrow('DATASET_CLOSED');
  });
  it('uses one writer, explicit init and identity validation instead of silently recreating data', () => {
    const path = root();
    expect(() => loadDataset(path)).toThrow();
    TaskDatabase.initialize(path);
    expect(() => TaskDatabase.initialize(path)).toThrow('DATA_ROOT_NOT_EMPTY');
    const database = new TaskDatabase(path); stores.push(database);
    expect(() => new TaskDatabase(path)).toThrow('DATASET_LOCKED');
    database.close();
    const markerPath = join(path, 'dataset.json');
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    writeFileSync(markerPath, JSON.stringify({ ...marker, datasetId: randomUUID() }));
    expect(() => new TaskDatabase(path)).toThrow('DATASET_INTEGRITY');
    expect(existsSync(join(path, 'writer.lock'))).toBe(false);
  });
  it('denies read-only writes, invalid keys and bounded or unknown fields', () => {
    const { database } = dataset(true);
    expect(database.list().readOnly).toBe(true);
    expect(() => database.mutate({ kind: 'create', key: randomUUID(), input })).toThrow('READ_ONLY');
    const writable = dataset().database;
    expect(() => writable.mutate({ kind: 'create', key: 'short', input })).toThrow('IDEMPOTENCY_KEY_REQUIRED');
    expect(TaskInput.parse({ ...input, title: '  标题  ' }).title).toBe('标题');
    for (const title of ['', '  ', '😀'.repeat(121)]) expect(TaskInput.safeParse({ ...input, title }).success).toBe(false);
    expect(TaskInput.safeParse({ ...input, title: '😀'.repeat(120) }).success).toBe(true);
    for (const value of [{ ...input, secret: true }, { ...input, description: 'x'.repeat(4001) }, { ...input, status: 'invalid' }]) expect(TaskInput.safeParse(value).success).toBe(false);
    expect(() => writable.mutate({ kind: 'create', key: randomUUID(), input: { ...input, title: '' } })).toThrow();
    expect(writable.list().tasks).toEqual([]);
  });
  it('preserves prepared DELETE-mode database bytes across read-only open, list and close', () => {
    const path = root(); TaskDatabase.initialize(path);
    const sqlitePath = join(path, 'app.sqlite'), connection = new DatabaseSync(sqlitePath);
    try { connection.exec('PRAGMA journal_mode=DELETE;'); } finally { connection.close(); }
    const original = readFileSync(sqlitePath), reader = new TaskDatabase(path, true); stores.push(reader);
    expect(reader.list()).toEqual({ tasks: [], readOnly: true });
    expect(() => reader.mutate({ kind: 'create', key: randomUUID(), input })).toThrow('READ_ONLY');
    expect(readFileSync(sqlitePath)).toEqual(original); reader.close();
    expect(readFileSync(sqlitePath)).toEqual(original);
    expect(existsSync(sqlitePath + '-wal')).toBe(false);
  });
  it('opens readers without creating a writer lock and preserves one writable owner', () => {
    const path = root(); TaskDatabase.initialize(path);
    const connection = new DatabaseSync(join(path, 'app.sqlite'));
    try { connection.exec('PRAGMA journal_mode=DELETE;'); } finally { connection.close(); }
    const reader = new TaskDatabase(path, true); stores.push(reader);
    expect(existsSync(join(path, 'writer.lock'))).toBe(false);
    const writer = new TaskDatabase(path); stores.push(writer);
    const lock = readFileSync(join(path, 'writer.lock'), 'utf8');
    const anotherReader = new TaskDatabase(path, true); stores.push(anotherReader);
    expect(anotherReader.list().readOnly).toBe(true);
    anotherReader.close(); reader.close();
    expect(readFileSync(join(path, 'writer.lock'), 'utf8')).toBe(lock);
    expect(() => new TaskDatabase(path)).toThrow('DATASET_LOCKED');
    writer.close(); expect(existsSync(join(path, 'writer.lock'))).toBe(false);
  });
  it('rejects linked, reserved, relative and unknown data paths', () => {
    expect(() => canonicalDataset('relative')).toThrow('DATA_ROOT_REQUIRED');
    expect(() => canonicalDataset(resolve('/'))).toThrow('DATA_ROOT_REQUIRED');
    expect(() => canonicalDataset(join(root(), '.devmesh-data'))).toThrow('DATA_ROOT_RESERVED');
    const parent = root(); mkdirSync(parent, { recursive: true });
    const target = join(parent, 'target'); writeFileSync(target, 'data');
    expect(() => canonicalDataset(join(target, 'dataset'))).toThrow('DATA_ROOT_UNSAFE');
    const hardlink = join(parent, 'hardlink'); linkSync(target, hardlink);
    expect(() => checkedFile(hardlink)).toThrow('DATA_FILE_UNSAFE');
    const original = join(parent, 'original'); mkdirSync(original);
    const link = join(parent, 'linked');
    symlinkSync(original, link, process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => canonicalDataset(join(link, 'dataset'))).toThrow('DATA_ROOT_UNSAFE');
  });
  it('refuses capacity overflow inside the transaction without retaining a failed receipt', () => {
    const { path, database } = dataset(); database.close();
    const connection = new DatabaseSync(join(path, 'app.sqlite'));
    const now = new Date().toISOString();
    connection.exec('BEGIN;');
    const insert = connection.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?)');
    for (let i = 0; i < 1000; i++) insert.run(randomUUID(), input.title, '', 'todo', 1, now, now);
    connection.exec('COMMIT;'); connection.close();
    const full = new TaskDatabase(path); stores.push(full);
    expect(() => full.mutate({ kind: 'create', key: randomUUID(), input })).toThrow('TASK_CAPACITY');
    expect(full.list().tasks).toHaveLength(1000);
    full.close();
    const connection2 = new DatabaseSync(join(path, 'app.sqlite'));
    connection2.exec('DELETE FROM tasks; BEGIN;');
    const insertReceipt = connection2.prepare('INSERT INTO receipts VALUES (?,?,?)');
    for (let i = 0; i < 10000; i++) insertReceipt.run(String(i), 'hash', '{}');
    connection2.exec('COMMIT;'); connection2.close();
    const receiptsFull = new TaskDatabase(path); stores.push(receiptsFull);
    expect(() => receiptsFull.mutate({ kind: 'create', key: randomUUID(), input })).toThrow('RECEIPT_CAPACITY');
  });
});
