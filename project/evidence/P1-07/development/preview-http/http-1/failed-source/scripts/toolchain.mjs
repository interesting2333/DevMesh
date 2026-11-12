import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const expectedNode = readFileSync(new URL('.node-version', root), 'utf8').trim();
const expectedPnpm = manifest.packageManager.slice('pnpm@'.length);
if (process.versions.node !== expectedNode) throw new Error(`Node ${expectedNode} required; found ${process.versions.node}`);
const actualPnpm = process.env.npm_config_user_agent?.match(/\bpnpm\/([^ ]+)/)?.[1];
if (actualPnpm !== expectedPnpm) throw new Error(`Run this check with pnpm ${expectedPnpm}; found ${actualPnpm ?? 'no pnpm user agent'}`);
for (const name of ['pnpm', 'typescript', 'tsdown', 'tsx', 'oxlint', '@types/node', '@types/express']) {
  const actual = JSON.parse(readFileSync(new URL(`node_modules/${name}/package.json`, root), 'utf8')).version;
  if (actual !== manifest.devDependencies[name]) throw new Error(`${name} expected ${manifest.devDependencies[name]}, found ${actual}`);
  console.log(`${name}: ${actual}`);
}
console.log(`toolchain OK: node ${expectedNode}, pnpm ${expectedPnpm}, ${process.platform}/${process.arch}`);
