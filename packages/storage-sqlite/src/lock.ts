import { closeSync, existsSync, lstatSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync, fsyncSync } from 'node:fs';
import { dirname, isAbsolute, resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { StorageError } from './errors.js';

export function acquireWriterLock(databasePath: string, recoveryToken?: string) {
  if (!isAbsolute(databasePath) || databasePath.startsWith('\\\\') || databasePath.startsWith('//')) throw new StorageError('DATABASE_PATH_INVALID', 422, 'An explicit absolute local database path is required');
  const path = resolve(realpathSync(dirname(databasePath)), basename(databasePath));
  if (existsSync(path) && (lstatSync(path).isSymbolicLink() || lstatSync(path).nlink !== 1)) throw new StorageError('DATABASE_PATH_INVALID', 422, 'Linked database files are not supported');
  const lockPath = path + '.writer.lock', guardPath = lockPath + '.guard';
  let guard: number;
  try { guard = openSync(guardPath, 'wx', 0o600); }
  catch { throw new StorageError('STORAGE_LOCKED', 423, 'Lock acquisition/recovery is already in progress; inspect an abandoned guard offline'); }
  const token = randomUUID();
  try {
    if (existsSync(lockPath)) {
      const old = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid: number; hostname: string; token: string };
      if (!Number.isSafeInteger(old.pid) || old.pid < 1 || old.hostname !== hostname()) throw new StorageError('LOCK_RECOVERY_REQUIRED', 423, 'Lock owner cannot be verified locally');
      let dead = false;
      try { process.kill(old.pid, 0); } catch (error) { dead = (error as NodeJS.ErrnoException).code === 'ESRCH'; }
      if (!dead || recoveryToken !== old.token) throw new StorageError('STORAGE_LOCKED', 423, 'Database has a live/unverified owner; dead-owner recovery requires its exact token', { pid: old.pid, recoveryToken: old.token });
      unlinkSync(lockPath);
    }
    const fd = openSync(lockPath, 'wx', 0o600);
    try { writeFileSync(fd, JSON.stringify({ pid: process.pid, hostname: hostname(), token, createdAt: new Date().toISOString() })); fsyncSync(fd); }
    finally { closeSync(fd); }
  } finally { closeSync(guard); unlinkSync(guardPath); }
  return { path, release() {
    if (existsSync(lockPath)) {
      const owner = JSON.parse(readFileSync(lockPath, 'utf8')) as { token: string };
      if (owner.token === token) unlinkSync(lockPath);
    }
  } };
}
