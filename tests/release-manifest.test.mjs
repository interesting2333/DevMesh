import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('release manifest reflects repository facts and makes no release claim', () => {
  const output = execFileSync('node', ['project/release-manifest.mjs'], { cwd: root, encoding: 'utf8' });
  const manifest = JSON.parse(output);
  const migrations = readFileSync(join(root, 'packages/storage-sqlite/migrations/manifest.json'));
  const openapi = readFileSync(join(root, 'packages/contracts/openapi.json'));
  const tasks = JSON.parse(readFileSync(join(root, 'project/tasks.json'), 'utf8'));
  assert.equal(manifest.format, 'devmesh.release-manifest.v1');
  assert.equal(manifest.databaseSchemaVersion, JSON.parse(migrations.toString('utf8')).at(-1).version);
  assert.equal(manifest.migrations.digest, sha256(migrations));
  assert.equal(manifest.openapi.digest, sha256(openapi));
  assert.equal(manifest.openapi.pathCount, Object.keys(JSON.parse(openapi.toString('utf8')).paths).length);
  assert.deepEqual(manifest.gates.map(gate => gate.id + '=' + gate.status), tasks.gates.map(gate => gate.id + '=' + gate.status));
  assert.equal(Object.values(manifest.workPackages).reduce((sum, count) => sum + count, 0), tasks.tasks.length);
  assert.ok(manifest.changes.some(change => change.name === 'implement-run-control-lifecycle' && change.total > 0));
  for (const forbidden of ['releasable', 'accepted', 'passed', 'ready']) assert.equal(Object.hasOwn(manifest, forbidden), false, forbidden);
});

test('release manifest write mode stores the same facts', { skip: existsSync(join(root, 'project/evidence/P4-04/release-manifest.json')) ? 'evidence already written' : false }, () => {
  const output = execFileSync('node', ['project/release-manifest.mjs', '--write'], { cwd: root, encoding: 'utf8' }).trim();
  const written = JSON.parse(readFileSync(output, 'utf8'));
  const fresh = JSON.parse(execFileSync('node', ['project/release-manifest.mjs'], { cwd: root, encoding: 'utf8' }));
  assert.equal(written.databaseSchemaVersion, fresh.databaseSchemaVersion);
  assert.deepEqual(written.gates, fresh.gates);
  rmSync(output);
});