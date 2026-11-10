import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TaskDatabase } from '../dist/server/database.js';
import { startService } from '../dist/server/service.js';
const parent = mkdtempSync(join(tmpdir(), 'devmesh-template-e2e-'));
const root = join(parent, 'dataset');
TaskDatabase.initialize(root);
const service = await startService({ root, port: 4318, webRoot: fileURLToPath(new URL('../dist/web/', import.meta.url)) });
console.log('E2E_READY ' + service.url);
const stop = async () => {
  await service.close();
  rmSync(parent, { recursive: true, force: true });
};
process.once('SIGTERM', () => { void stop(); });
process.once('SIGINT', () => { void stop(); });
