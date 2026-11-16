import { loadConfig } from '../packages/platform-core/dist/config.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const index = args.indexOf('--config');
const configPath = index >= 0 ? args[index + 1] : undefined;
if (index >= 0 && (!configPath || args.length !== 2)) {
  process.stderr.write('Usage: node scripts/dev-preview.mjs --config <file.json>\n');
  process.exit(2);
}

const config = loadConfig(process.env, configPath);
const { startPlatform } = await import('../packages/platform-core/dist/index.mjs');
const { createModelSettingsStore } = await import('../packages/input-api/dist/index.mjs');
const modelSettings = createModelSettingsStore(join(config.storage?.dataRoot ?? '.devmesh-data/control', 'settings'));
const saved = await modelSettings.readForRuntime();

const identityResolver = async () => ({ principalId: 'user_1' });
let platform;
if (saved) {
  try {
    const runtime = {
      providers: [{
        providerId: saved.settings.providerId,
        endpoint: saved.settings.endpoint,
        model: saved.settings.model,
        credentialRef: 'models.local',
        connectTimeoutMs: 10000,
        requestTimeoutMs: 120000,
        capabilities: {
          revision: 'operator-declared.v1', contextTokens: 8192, maxOutputTokens: 2048, toolCalls: true,
          structuredOutput: 'json-object', tokenCounting: 'utf8-conservative-v1', reasoningMode: 'disabled', verification: 'DECLARED'
        }
      }],
      tokenLimit: 100000
    };
    const a2a = config.a2a ?? {
      manifestPath: join(repositoryRoot, 'config', 'agents.example.json'),
      identities: [{ principalId: 'orchestrator', credentialRef: 'internal.service' }]
    };
    platform = await startPlatform({ ...config, runtime, a2a }, {
      identityResolver,
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
platform ??= await startPlatform(config, { identityResolver });

const address = `http://${platform.address.address}:${platform.address.port}`;
process.stdout.write(JSON.stringify({ event: 'preview-ready', url: address + '/api/v1/workbench/view', base: address }) + '\n');

const stop = async () => {
  try { await platform.stop(); } finally { process.exit(0); }
};
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });