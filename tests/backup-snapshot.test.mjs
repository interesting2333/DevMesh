import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fixture, project } from './fixtures/storage-data.mjs';
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

test('backup creates a verified consistent snapshot outside the database directory', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root), directory = join(f.root, 'backup');
  mkdirSync(directory, { recursive: true });
  const backup = await f.storage.request('createBackup', { destinationDirectory: directory, label: 'manual' });
  assert.ok(existsSync(backup.path));
  assert.ok(backup.byteSize > 0);
  assert.match(backup.sha256, /^[a-f0-9]{64}$/);
  assert.equal(createHash('sha256').update(readFileSync(backup.path)).digest('hex'), backup.sha256);
  const copy = new DatabaseSync(backup.path);
  try {
    assert.equal(copy.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    assert.equal(copy.prepare('SELECT count(*) n FROM runs').get().n, 1);
    assert.equal(copy.prepare('SELECT project_id FROM projects WHERE project_id=?').get(p.projectId).project_id, p.projectId);
  } finally { copy.close(); }
  await rejects(f.storage.request('createBackup', { destinationDirectory: join(f.root, 'db') }), 'BACKUP_PATH_OVERLAP');
  await rejects(f.storage.request('createBackup', { destinationDirectory: join(f.root, 'missing') }), 'BACKUP_DIRECTORY_REQUIRED');
  await rejects(f.storage.request('createBackup', { destinationDirectory: 'relative/backup' }), 'BACKUP_DIRECTORY_REQUIRED');
});
