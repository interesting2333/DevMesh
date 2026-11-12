import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'tsdown';

const root = fileURLToPath(new URL('../', import.meta.url));
const order = ['cosmokit', 'schemastery', 'cordis', 'loader', 'include'];
const result = spawnSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-b', ...order.map(name => `vendor/${name}`)], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
for (const name of order) {
  const directory = resolve(root, 'vendor', name);
  const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  await build({
    entry: [resolve(directory, 'lib/types/index.js')],
    outDir: resolve(directory, 'lib'),
    format: name === 'schemastery' ? ['esm', 'cjs'] : ['esm'],
    outExtensions: ({ format }) => ({ js: name === 'schemastery' ? (format === 'cjs' ? '.cjs' : '.mjs') : '.js' }),
    platform: 'node', target: 'node24', clean: false, dts: false, sourcemap: true,
    deps: { neverBundle: [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})] },
  });
}
