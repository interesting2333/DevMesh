import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const template = resolve(root, 'templates/web-crud-v1');
const output = resolve(root, process.argv[2] ?? '.artifacts/template');
mkdirSync(output, { recursive: true });
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => {
  if (['node_modules', 'dist', 'coverage', '.artifacts', 'test-results', 'playwright-report', '.test-data'].includes(entry.name)) return [];
  const target = resolve(path, entry.name);
  if (entry.isSymbolicLink()) throw new Error('Unexpected source symlink');
  return entry.isDirectory() ? walk(target) : [target];
});
const hash = value => createHash('sha256').update(value).digest('hex');
const inputs = walk(template).map(path => ({ path: relative(template, path).replaceAll('\\', '/'), sha256: hash(readFileSync(path)) })).sort((a, b) => a.path.localeCompare(b.path, 'en'));
const manifest = JSON.parse(readFileSync(resolve(template, 'template.json'), 'utf8'));
if (manifest.runtime.imageDigest !== null && !/^sha256:[a-f0-9]{64}$/.test(manifest.runtime.imageDigest)) throw new Error('Invalid execution image digest');
if (manifest.runtime.imageDigest === null && manifest.runtime.imageStatus !== 'PENDING_TARGET_VALIDATION') throw new Error('Missing image must remain pending');
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
const dirty = spawnSync('git', ['status', '--porcelain', '--', 'templates/web-crud-v1', 'scripts/verify-template.mjs'], { cwd: root, encoding: 'utf8' });
const report = {
  schemaVersion: 1, startedAt: new Date().toISOString(), sourceCommit: git.status === 0 ? git.stdout.trim() : null,
  dirty: dirty.status !== 0 || !!dirty.stdout.trim(), node: process.version, platform: process.platform,
  sourceFingerprint: hash(JSON.stringify(inputs)), sourceFiles: inputs,
  lockfileSha256: hash(readFileSync(resolve(template, 'pnpm-lock.yaml'))),
  runnerValidation: 'NOT_EXECUTED', enterpriseAuthentication: 'NOT_CONFIGURED',
  browserChannel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ?? 'bundled-chromium',
  checks: [], status: 'RUNNING'
};
const rootPnpm = resolve(root, 'node_modules/pnpm/bin/pnpm.cjs');
const pnpm = existsSync(rootPnpm) ? rootPnpm : resolve(template, 'node_modules/pnpm/bin/pnpm.cjs');
const steps = [
  ['frozen-install', [pnpm, 'install', '--frozen-lockfile']],
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.json']],
  ['build-server', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json']],
  ['build-web', ['node_modules/vite/bin/vite.js', 'build']],
  ['unit-coverage', ['node_modules/vitest/vitest.mjs', 'run', '--coverage']],
  ['browser', ['node_modules/@playwright/test/cli.js', 'test']]
];
for (const [name, args] of steps) {
  console.log(name);
  const start = Date.now();
  const result = spawnSync(process.execPath, args, { cwd: template, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CI: 'true', NO_COLOR: '1' } });
  const text = (result.stdout ?? '') + (result.stderr ?? '') + (result.error ? String(result.error) : '');
  const filename = name + '.txt'; writeFileSync(resolve(output, filename), text);
  report.checks.push({ name, exitCode: result.status, durationMs: Date.now() - start, output: filename, sha256: hash(text) });
  if (result.status !== 0) { report.status = 'FAILED'; break; }
  if (name === 'unit-coverage') {
    const coveragePath = resolve(template, 'coverage/coverage-final.json');
    if (!existsSync(coveragePath)) { report.status = 'FAILED'; report.coverageError = 'MISSING_REPORT'; break; }
    const covered = Object.keys(JSON.parse(readFileSync(coveragePath, 'utf8'))).map(path => relative(template, path).replaceAll('\\', '/'));
    const business = inputs.map(input => input.path).filter(path => path.startsWith('src/') && /\.(ts|tsx)$/.test(path) && !path.endsWith('.d.ts'));
    report.coverageFiles = covered;
    const missing = business.filter(path => !covered.includes(path));
    if (missing.length) { report.status = 'FAILED'; report.missingCoverageFiles = missing; break; }
  }
}
const afterInputs = walk(template).map(path => ({ path: relative(template, path).replaceAll('\\', '/'), sha256: hash(readFileSync(path)) })).sort((a, b) => a.path.localeCompare(b.path, 'en'));
if (JSON.stringify(afterInputs) !== JSON.stringify(inputs)) { report.status = 'FAILED'; report.sourceDrift = true; }
if (report.status === 'RUNNING') report.status = 'PASSED';
report.finishedAt = new Date().toISOString();
writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.status + ': ' + relative(root, resolve(output, 'report.json')));
if (report.status !== 'PASSED') process.exitCode = 1;
