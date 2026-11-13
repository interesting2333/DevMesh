import { existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, realpathSync, readdirSync, unlinkSync, writeFileSync, fsyncSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../shared/task.js';

const Marker = z.object({ kind: z.literal('web-crud-dataset'), templateId: z.literal('web-crud-v1'), layoutVersion: z.literal(1), datasetId: z.uuid() }).strict();
export type DatasetMarker = z.infer<typeof Marker>;
const markerName = 'dataset.json';
export function canonicalDataset(root: string): string {
  if (!isAbsolute(root) || resolve(root) === parse(root).root) throw new AppError('DATA_ROOT_REQUIRED', 500);
  const canonical = resolve(root);
  if (canonical.split(/[\\/]/).some(part => ['.devmesh-data', '.devmesh-runner', '.devmesh-backups', '.devmesh-secrets'].includes(process.platform === 'win32' ? part.toLowerCase() : part))) throw new AppError('DATA_ROOT_RESERVED', 500);
  let current = canonical;
  while (true) {
    if (existsSync(current) && (lstatSync(current).isSymbolicLink() || !lstatSync(current).isDirectory())) throw new AppError('DATA_ROOT_UNSAFE', 500);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (existsSync(canonical) && realpathSync(canonical).toLowerCase() !== canonical.toLowerCase()) throw new AppError('DATA_ROOT_UNSAFE', 500);
  return canonical;
}
export function checkedFile(path: string): void {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new AppError('DATA_FILE_UNSAFE', 500);
}
export function writeDurable(path: string, text: string): void {
  const descriptor = openSync(path, 'wx', 0o600);
  try { writeFileSync(descriptor, text); fsyncSync(descriptor); } finally { closeSync(descriptor); }
}
export function prepareDataset(root: string): { root: string; marker: DatasetMarker } {
  root = canonicalDataset(root);
  if (existsSync(root) && readdirSync(root).length !== 0) throw new AppError('DATA_ROOT_NOT_EMPTY', 500);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const marker = Marker.parse({ kind: 'web-crud-dataset', templateId: 'web-crud-v1', layoutVersion: 1, datasetId: randomUUID() });
  writeDurable(join(root, markerName), JSON.stringify(marker) + '\n');
  return { root, marker };
}
export function loadDataset(root: string): { root: string; marker: DatasetMarker } {
  root = canonicalDataset(root);
  checkedFile(join(root, markerName));
  const marker = Marker.parse(JSON.parse(readFileSync(join(root, markerName), 'utf8')));
  checkedFile(join(root, 'app.sqlite'));
  for (const name of ['app.sqlite-wal', 'app.sqlite-shm']) if (existsSync(join(root, name))) checkedFile(join(root, name));
  return { root, marker };
}
export function lockDataset(root: string, runtimeRoot?: string): () => void {
  let path = join(root, 'writer.lock');
  if (runtimeRoot !== undefined) {
    const runtime = canonicalDataset(runtimeRoot);
    const data = canonicalDataset(root);
    if (runtime.toLowerCase() === data.toLowerCase() || runtime.toLowerCase().startsWith(data.toLowerCase() + (process.platform === 'win32' ? '\\' : '/'))) throw new AppError('RUNTIME_ROOT_OVERLAPS_DATA', 500);
    mkdirSync(runtime, { recursive: true, mode: 0o700 });
    path = join(runtime, createHash('sha256').update(data).digest('hex') + '.lock');
  }
  const token = randomUUID();
  try { writeDurable(path, JSON.stringify({ pid: process.pid, token }) + '\n'); }
  catch { throw new AppError('DATASET_LOCKED', 503); }
  return () => {
    checkedFile(path);
    const lock = JSON.parse(readFileSync(path, 'utf8')) as { token: string };
    if (lock.token !== token) throw new AppError('DATASET_LOCK_CHANGED', 500);
    unlinkSync(path);
  };
}
