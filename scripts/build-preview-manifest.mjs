import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoleCard, cardHash } from '../packages/a2a-adapter/dist/index.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'config', 'agents.example.json');
const target = join(root, '.devmesh-data', 'preview', 'agents.json');
const manifest = JSON.parse(readFileSync(source, 'utf8'));
const changed = [];
for (const endpoint of manifest.endpoints) {
  if (!endpoint.role || !['product', 'architect'].includes(endpoint.role)) continue;
  const skill = `devmesh.prepare.${endpoint.role}`;
  if (!endpoint.supportedSkills.includes(skill)) {
    endpoint.supportedSkills.push(skill);
    changed.push(endpoint.endpointId + ' +' + skill);
  }
  endpoint.cardHash = cardHash(createRoleCard(endpoint));
}
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(JSON.stringify({ target: resolve(target), changed, endpoints: manifest.endpoints.map(endpoint => endpoint.endpointId) }, null, 2) + '\n');