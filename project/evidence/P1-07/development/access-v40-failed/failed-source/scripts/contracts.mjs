import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createOpenApiDocument } from '../packages/contracts/dist/index.js';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Usage: node scripts/contracts.mjs [--check]');
const path = fileURLToPath(new URL('../packages/contracts/openapi.json', import.meta.url));
const expected = JSON.stringify(createOpenApiDocument(), null, 2) + '\n';
if (args[0] === '--check') {
  if (readFileSync(path, 'utf8') !== expected) throw new Error('OpenAPI drift: run pnpm contracts:generate and commit the result');
  console.log('OpenAPI matches the executable contracts');
} else {
  writeFileSync(path, expected);
  console.log('Generated packages/contracts/openapi.json');
}
