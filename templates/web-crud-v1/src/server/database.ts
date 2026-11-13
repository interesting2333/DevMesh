import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { AppError, Task, TaskInput, type TaskList } from '../shared/task.js';
import { loadDataset, lockDataset, prepareDataset } from './dataset.js';

export type Mutation = { kind: 'create'; key: string; input: TaskInput } | { kind: 'update'; key: string; id: string; revision: number; input: TaskInput } | { kind: 'delete'; key: string; id: string; revision: number };
export type MutationResult = { status: number; task: Task | null };
const schema = `
CREATE TABLE dataset_identity (singleton INTEGER PRIMARY KEY CHECK(singleton=1),dataset_id TEXT NOT NULL) STRICT;
CREATE TABLE tasks (id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('todo','doing','done')),revision INTEGER NOT NULL CHECK(revision>0),createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL) STRICT;
CREATE TABLE receipts (key TEXT PRIMARY KEY,request_hash TEXT NOT NULL,response TEXT NOT NULL) STRICT;
PRAGMA user_version=1;
`;
export class TaskDatabase {
  private readonly database: DatabaseSync;
  private readonly release: () => void;
  private closed = false;
  static initialize(root: string): void {
    const dataset = prepareDataset(root);
    const release = lockDataset(dataset.root);
    const database = new DatabaseSync(join(dataset.root, 'app.sqlite'));
    try {
      database.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; BEGIN IMMEDIATE;');
      database.exec(schema);
      database.prepare('INSERT INTO dataset_identity VALUES (1,?)').run(dataset.marker.datasetId);
      database.exec('COMMIT;');
    } finally { database.close(); release(); }
  }
  constructor(root: string, private readonly readOnly = false, runtimeRoot?: string) {
    const dataset = loadDataset(root);
    // Readers must work on a wholly read-only mount. Physical custody and write
    // admission belong to the Runner; only a writable connection owns this lock.
    this.release = readOnly ? () => {} : lockDataset(dataset.root, runtimeRoot);
    let opened: DatabaseSync | undefined;
    try {
      this.database = opened = new DatabaseSync(join(dataset.root, 'app.sqlite'), { readOnly });
      this.database.exec(readOnly
        ? 'PRAGMA query_only=ON; PRAGMA busy_timeout=1000;'
        : 'PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000;');
      const version = this.database.prepare('PRAGMA user_version').get() as { user_version: number };
      const identity = this.database.prepare('SELECT dataset_id FROM dataset_identity WHERE singleton=1').get() as { dataset_id: string } | undefined;
      const integrity = this.database.prepare('PRAGMA quick_check').get() as { quick_check: string };
      if (version.user_version !== 1 || identity?.dataset_id !== dataset.marker.datasetId || integrity.quick_check !== 'ok') throw new AppError('DATASET_INTEGRITY', 500);
    } catch (error) { opened?.close(); this.release(); throw error; }
  }
  list(): TaskList {
    this.assertOpen();
    return { tasks: this.database.prepare('SELECT * FROM tasks ORDER BY createdAt,id LIMIT 1000').all().map(row => Task.parse(row)), readOnly: this.readOnly };
  }
  mutate(raw: Mutation): MutationResult {
    this.assertOpen();
    if (this.readOnly) throw new AppError('READ_ONLY', 403);
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(raw.key)) throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400);
    const operation = raw.kind === 'delete' ? raw : { ...raw, input: TaskInput.parse(raw.input) };
    const hash = createHash('sha256').update(JSON.stringify(operation)).digest('hex');
    // Startup and health must not change the prepared snapshot. In a release,
    // the physical guard admits this first database write only after publication.
    this.database.exec('PRAGMA journal_mode=WAL; BEGIN IMMEDIATE;');
    try {
      const previous = this.database.prepare('SELECT request_hash,response FROM receipts WHERE key=?').get(raw.key) as { request_hash: string; response: string } | undefined;
      if (previous) {
        if (previous.request_hash !== hash) throw new AppError('IDEMPOTENCY_CONFLICT', 409);
        const result = JSON.parse(previous.response) as MutationResult;
        this.database.exec('COMMIT;');
        return result;
      }
      const receipts = this.database.prepare('SELECT count(*) AS n FROM receipts').get() as { n: number };
      if (receipts.n >= 10000) throw new AppError('RECEIPT_CAPACITY', 507);
      let result: MutationResult;
      const now = new Date().toISOString();
      if (operation.kind === 'create') {
        const count = this.database.prepare('SELECT count(*) AS n FROM tasks').get() as { n: number };
        if (count.n >= 1000) throw new AppError('TASK_CAPACITY', 409);
        const task: Task = { ...operation.input, id: randomUUID(), revision: 1, createdAt: now, updatedAt: now };
        this.database.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?)').run(task.id, task.title, task.description, task.status, task.revision, task.createdAt, task.updatedAt);
        result = { status: 201, task };
      } else {
        const current = this.database.prepare('SELECT * FROM tasks WHERE id=?').get(operation.id);
        if (!current) throw new AppError('TASK_NOT_FOUND', 404);
        const task = Task.parse(current);
        if (task.revision !== operation.revision) throw new AppError('REVISION_CONFLICT', 409);
        if (operation.kind === 'delete') {
          this.database.prepare('DELETE FROM tasks WHERE id=? AND revision=?').run(task.id, task.revision);
          result = { status: 200, task: null };
        } else {
          const next: Task = { ...task, ...operation.input, revision: task.revision + 1, updatedAt: now };
          this.database.prepare('UPDATE tasks SET title=?,description=?,status=?,revision=?,updatedAt=? WHERE id=? AND revision=?').run(next.title, next.description, next.status, next.revision, now, task.id, task.revision);
          result = { status: 200, task: next };
        }
      }
      this.database.prepare('INSERT INTO receipts VALUES (?,?,?)').run(raw.key, hash, JSON.stringify(result));
      this.database.exec('COMMIT;');
      return result;
    } catch (error) { this.database.exec('ROLLBACK;'); throw error; }
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    try { this.database.close(); } finally { this.release(); }
  }
  private assertOpen(): void { if (this.closed) throw new AppError('DATASET_CLOSED', 503); }
}
