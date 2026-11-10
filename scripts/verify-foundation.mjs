import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { release } from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i];
  if (!['--commit', '--output'].includes(flag) || !process.argv[i + 1] || options[flag]) throw new Error('Usage: pnpm verify:foundation --commit <40-character SHA> [--output <directory>]');
  options[flag] = process.argv[i + 1];
}
const commit = options['--commit'];
if (!/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('Provide the full commit SHA of the verified source snapshot');
if (existsSync(resolve(root, '.git'))) {
  const actual = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (actual.status !== 0 || actual.stdout.trim() !== commit) throw new Error('Verification commit does not match this checkout HEAD');
  const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' });
  if (dirty.status !== 0 || dirty.stdout.trim()) throw new Error('Verify a clean source snapshot; commit changes or use git archive');
}
const output = resolve(root, options['--output'] ?? '.artifacts/foundation');
mkdirSync(output, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => {
  if (['node_modules', 'lib', 'dist'].includes(entry.name) || entry.name.endsWith('.tsbuildinfo')) return [];
  const target = resolve(path, entry.name);
  if (entry.isSymbolicLink()) throw new Error(`Unexpected source symlink: ${target}`);
  return entry.isDirectory() ? walk(target) : [target];
});
const inputs = [
  ...['apps', 'packages', 'vendor', 'scripts', 'tests', 'config', '.github'].flatMap(name => walk(resolve(root, name))),
  ...['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'tsconfig.vendor.json', '.node-version', '.nvmrc'].map(name => resolve(root, name)),
].map(path => ({ path: relative(root, path).replaceAll('\\', '/'), sha256: hash(readFileSync(path)) })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const pnpm = resolve(root, 'node_modules/pnpm/bin/pnpm.cjs');
const steps = [
  ...['toolchain:check', 'vendor:verify', 'build', 'typecheck', 'lint', 'test:smoke', 'test:contracts', 'test:storage', 'test:content', 'test:a2a', 'contracts:check', 'project:check'].map(name => ({ name, args: [pnpm, 'run', name] })),
  { name: 'openspec', args: ['project/openspec.mjs', 'validate', '--all', '--strict', '--no-interactive'] },
  { name: 'design-consistency', args: ['design/生成完整方案.mjs', '--check'] },
];
const report = {
  schemaVersion: 1, commit, startedAt: new Date().toISOString(), platform: process.platform, arch: process.arch,
  kernel: release(), node: process.version, sourceFingerprint: hash(JSON.stringify(inputs)),
  lockfileSha256: hash(readFileSync(resolve(root, 'pnpm-lock.yaml'))), sourceFiles: inputs,
  status: 'RUNNING', checks: [],
};
for (const [index, step] of steps.entries()) {
  console.log(`[${index + 1}/${steps.length}] ${step.name}`);
  const started = Date.now();
  const result = spawnSync(process.execPath, step.args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CI: 'true', NO_COLOR: '1' } });
  const text = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}\n` : ''}`;
  const filename = `${String(index + 1).padStart(2, '0')}-${step.name.replaceAll(':', '-')}.txt`;
  writeFileSync(resolve(output, filename), text);
  const check = { name: step.name, exitCode: result.status, signal: result.signal, durationMs: Date.now() - started, output: filename, sha256: hash(text) };
  if (step.name.startsWith('test:')) check.tests = Object.fromEntries(['tests', 'pass', 'fail', 'skipped'].map(key => [key, Number(result.stdout.match(new RegExp(`^# ${key} (\\d+)$`, 'm'))?.[1] ?? NaN)]));
  report.checks.push(check);
  if (result.status !== 0) { console.error(text); report.status = 'FAILED'; break; }
}
if (report.status === 'RUNNING') report.status = 'PASSED';
report.finishedAt = new Date().toISOString();
writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.status}: ${relative(root, resolve(output, 'report.json'))}`);
if (report.status !== 'PASSED') process.exitCode = 1;
