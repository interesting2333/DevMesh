#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFileSync(join(root, path));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

const tasks = JSON.parse(read('project/tasks.json').toString('utf8'));
const migrations = JSON.parse(read('packages/storage-sqlite/migrations/manifest.json').toString('utf8'));
const openapi = JSON.parse(read('packages/contracts/openapi.json').toString('utf8'));
const rootPackage = JSON.parse(read('package.json').toString('utf8'));

let gitHead = 'unknown';
try { gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* not a git checkout */ }

const packages = [];
for (const entry of readdirSync(join(root, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(readFileSync(join(root, 'packages', entry.name, 'package.json'), 'utf8'));
    packages.push({ directory: entry.name, name: manifest.name, version: manifest.version });
  } catch { /* packages without a manifest are ignored */ }
}
packages.sort((left, right) => left.directory.localeCompare(right.directory));

const changes = [];
for (const entry of readdirSync(join(root, 'openspec/changes'), { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'archive') continue;
  let markdown = '';
  try { markdown = readFileSync(join(root, 'openspec/changes', entry.name, 'tasks.md'), 'utf8'); } catch { continue; }
  const items = [...markdown.matchAll(/^- \[([ x])\] /gm)];
  changes.push({ name: entry.name, done: items.filter(match => match[1] === 'x').length, total: items.length });
}
changes.sort((left, right) => left.name.localeCompare(right.name));

const workPackages = {};
for (const task of tasks.tasks) workPackages[task.status] = (workPackages[task.status] ?? 0) + 1;

const manifest = {
  format: 'devmesh.release-manifest.v1',
  generatedAt: new Date().toISOString(),
  gitHead,
  rootPackage: { name: rootPackage.name, version: rootPackage.version },
  packages,
  databaseSchemaVersion: migrations.at(-1)?.version ?? 0,
  migrations: { count: migrations.length, digest: sha256(read('packages/storage-sqlite/migrations/manifest.json')) },
  openapi: { digest: sha256(read('packages/contracts/openapi.json')), pathCount: Object.keys(openapi.paths ?? {}).length },
  gates: (tasks.gates ?? []).map(gate => ({ id: gate.id, name: gate.name ?? null, status: gate.status })),
  workPackages,
  changes
};

const serialized = JSON.stringify(manifest, null, 2) + '\n';
if (process.argv.includes('--write')) {
  const output = resolve(root, 'project/evidence/P4-04/release-manifest.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, serialized);
  process.stdout.write(output + '\n');
} else {
  process.stdout.write(serialized);
}