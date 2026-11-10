import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../tools/openspec/node_modules/@fission-ai/openspec/bin/openspec.js', import.meta.url));
if (!existsSync(cli)) {
  console.error('请先在仓库根目录运行：npm ci --prefix tools/openspec');
  process.exit(1);
}
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, OPENSPEC_TELEMETRY: '0' },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
