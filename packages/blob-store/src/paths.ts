import { existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { StorageError } from '@devmesh/storage-sqlite';

export function fail(code: string, message: string, status = 409): never { throw new StorageError(code, status, message); }
export function canonicalRoot(path: string): string {
  if (!isAbsolute(path) || path.startsWith('\\\\') || path.startsWith('//') || path.includes('\0') || (process.platform === 'win32' && !/^[A-Za-z]:[\\/]/.test(path))) fail('ROOT_PATH_INVALID', 'An absolute local root path is required', 422);
  const resolved = resolve(path), root = parse(resolved).root;
  if (resolved === root) fail('ROOT_PATH_INVALID', 'A filesystem root cannot be the data directory', 422);
  let current = root;
  for (const part of resolved.slice(root.length).split(sep)) {
    current = join(current, part);
    if (existsSync(current)) {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail('ROOT_LINK_INVALID', 'Storage roots cannot traverse links or non-directories');
      current = realpathSync(current);
    } else {
      // lstat detects dangling links that existsSync treats as absent.
      try { if (lstatSync(current).isSymbolicLink()) fail('ROOT_LINK_INVALID', 'Dangling links are not storage roots'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
  return current;
}
export function isWithin(parent: string, child: string): boolean {
  const normalize = (p: string) => process.platform === 'win32' ? p.toLowerCase() : p;
  const rel = relative(normalize(parent), normalize(child));
  return rel === '' || (!rel.startsWith('..'+sep) && rel !== '..' && !isAbsolute(rel));
}
export function assertSeparate(roots: string[]): void {
  for (let a=0;a<roots.length;a++) for (let b=a+1;b<roots.length;b++) if (isWithin(roots[a]!,roots[b]!) || isWithin(roots[b]!,roots[a]!)) fail('STORAGE_ROOTS_OVERLAP', 'Control, Runner and backup roots must be separate');
}
function segments(key: string): string[] {
  const parts = key.split('/');
  if (!parts.length || parts.some(p => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(p) || p.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) fail('STORAGE_KEY_INVALID', 'Storage keys must be controlled relative names', 422);
  return parts;
}
export function safePath(root: string, key: string, makeParents = false): string {
  const parts = segments(key);
  canonicalRoot(root);
  let current = root;
  for (const [i, part] of parts.entries()) {
    current = join(current,part);
    if (makeParents && i < parts.length-1 && !existsSync(current)) {
      try { mkdirSync(current,{mode:0o700}); }
      catch(error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    }
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || (i<parts.length-1 && !stat.isDirectory()) || (i===parts.length-1 && !stat.isFile())) fail('STORAGE_LINK_INVALID', 'Object path traverses a link or unexpected entry');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  if (!isWithin(root,current) || dirname(current) === current) fail('STORAGE_KEY_INVALID','Object escapes its root',422);
  return current;
}
