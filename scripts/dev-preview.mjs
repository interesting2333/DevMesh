import { loadConfig } from '../packages/platform-core/dist/config.mjs';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLocalPlaywrightService } from '../tools/playwright-mcp/local-service.mjs';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const index = args.indexOf('--config');
const configPath = index >= 0 ? args[index + 1] : undefined;
if (index >= 0 && (!configPath || args.length !== 2)) {
  process.stderr.write('Usage: node scripts/dev-preview.mjs --config <file.json>\n');
  process.exit(2);
}

const loaded = loadConfig(process.env, configPath);
const config = loaded.inputApi && !loaded.mcp ? { ...loaded, mcp: { administrator: 'user_1' } } : loaded;
const { startPlatform } = await import('../packages/platform-core/dist/index.mjs');
const { createModelSettingsStore } = await import('../packages/input-api/dist/index.mjs');
const { loadInternalA2AConfig } = await import('../packages/a2a-adapter/dist/config.mjs');
const modelSettings = createModelSettingsStore(join(config.storage?.dataRoot ?? '.devmesh-data/control', 'settings'));
const saved = await modelSettings.readForRuntime();

const identityResolver = async () => ({ principalId: 'user_1' });
const taskBoard = join(repositoryRoot, 'templates', 'web-crud-v1');
const playwrightPreviewResultsDir = join(taskBoard, 'playwright-mcp-results');
const localPlaywright = config.inputApi && config.mcp ? await createLocalPlaywrightService({
  workspace: taskBoard, results: playwrightPreviewResultsDir,
  settingsFile: join(config.storage?.dataRoot ?? '.devmesh-data/control', 'settings', 'playwright-mcp.json')
}) : undefined;
let platform;
if (saved) {
  try {
    const runtime = {
      providers: [{
        providerId: saved.settings.providerId,
        endpoint: saved.settings.endpoint,
        model: saved.settings.model,
        credentialRef: 'models.local',
        responseMode: 'sse',
        connectTimeoutMs: 120000,
        requestTimeoutMs: 300000,
        capabilities: {
          revision: 'operator-declared.v1', contextTokens: 32768, maxOutputTokens: 4096, toolCalls: true,
          structuredOutput: 'json-object', tokenCounting: 'utf8-conservative-v1', reasoningMode: 'disabled', verification: 'DECLARED'
        }
      }],
      tokenLimit: 200000,
      preparation: {
        callerId: 'orchestrator',
        productProviderId: saved.settings.providerId,
        architectProviderId: saved.settings.providerId,
        maxInputBytes: 200000,
        maxOutputTokens: 4096,
        bootstrapPaths: []
      }
    };
    const previewManifest = join(repositoryRoot, '.devmesh-data', 'preview', 'agents.json');
    const manifestPath = existsSync(previewManifest) ? previewManifest : join(repositoryRoot, 'config', 'agents.example.json');
    const a2a = config.a2a ?? loadInternalA2AConfig({
      manifestPath,
      identities: [{ principalId: 'orchestrator', credentialRef: 'internal.service' }]
    }, join(repositoryRoot, '.devmesh-data', 'preview', 'server.json'));
    platform = await startPlatform({ ...config, runtime, a2a }, {
      identityResolver,
      playwrightPreviewResultsDir,
      localPlaywright,
      resolveCredential: async reference => {
        if (reference === 'models.local') return saved.apiKey;
        if (reference === 'internal.service') return 'local-internal-service';
        return undefined;
      }
    });
    process.stdout.write(JSON.stringify({ event: 'model-runtime-attached', providerId: saved.settings.providerId, model: saved.settings.model }) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ event: 'model-runtime-failed', code: error?.code ?? 'RUNTIME_ATTACH_FAILED', message: String(error?.message ?? error) }) + '\n');
  }
}
try { platform ??= await startPlatform(config, { identityResolver, playwrightPreviewResultsDir, localPlaywright }); }
catch (error) { await localPlaywright?.close(); throw error; }

const address = `http://${platform.address.address}:${platform.address.port}`;
process.stdout.write(JSON.stringify({ event: 'preview-ready', url: address + '/api/v1/workbench/view', base: address }) + '\n');

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  try { await localPlaywright?.close(); }
  finally {
    try { await platform.stop(); } finally { process.exit(0); }
  }
};
const { createServer } = await import('node:http');
createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/shutdown') {
    response.end('stopping');
    void stop();
    return;
  }
  response.statusCode = 404;
  response.end();
}).listen(3212, '127.0.0.1');
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
