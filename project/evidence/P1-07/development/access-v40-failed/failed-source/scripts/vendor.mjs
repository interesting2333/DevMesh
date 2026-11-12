import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'vendor/manifest.json'), 'utf8'));
let count = 0;
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  if (entry.isSymbolicLink()) throw new Error(`Vendor symlinks are forbidden: ${entry.name}`);
  if (['node_modules', 'lib'].includes(entry.name) || entry.name.endsWith('.tsbuildinfo')) return [];
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});
for (const pkg of manifest.packages) {
  const directory = resolve(root, 'vendor', pkg.directory);
  const paths = walk(directory).map(path => relative(directory, path).replaceAll('\\', '/')).sort();
  if (JSON.stringify(paths) !== JSON.stringify(Object.keys(pkg.files).sort())) throw new Error(`Vendor file set changed: ${pkg.name}`);
  for (const [path, expected] of Object.entries(pkg.files)) {
    const target = resolve(directory, path);
    const inside = relative(directory, target);
    if (isAbsolute(inside) || inside.startsWith('..') || !existsSync(target)) throw new Error(`Unsafe vendor path: ${path}`);
    const actual = createHash('sha256').update(readFileSync(target)).digest('hex');
    if (actual !== expected) throw new Error(`Vendor checksum mismatch: ${pkg.directory}/${path}`);
    count++;
  }
  const metadata = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  if (metadata.name !== pkg.name || metadata.version !== pkg.version || metadata.license !== 'MIT') throw new Error(`Vendor metadata changed: ${pkg.name}`);
  if (!paths.some(path => path.startsWith('src/')) || !paths.includes('LICENSE')) throw new Error(`Missing source or license: ${pkg.name}`);
}
console.log(`Vendor OK: ${manifest.packages.length} packages, ${count} pinned source/license/config files.`);
