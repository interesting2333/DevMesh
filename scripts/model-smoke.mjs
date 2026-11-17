import { join } from 'node:path';
import { loadConfig } from '../packages/platform-core/dist/config.mjs';
import { createModelSettingsStore } from '../packages/input-api/dist/index.mjs';
import { DeepSeekProvider } from '../packages/agent-runtime/dist/index.mjs';

const args = process.argv.slice(2);
const index = args.indexOf('--config');
const configPath = index >= 0 ? args[index + 1] : undefined;
const config = loadConfig(process.env, configPath);
const store = createModelSettingsStore(join(config.storage?.dataRoot ?? '.devmesh-data/control', 'settings'));
const saved = await store.readForRuntime();
if (!saved) {
  process.stderr.write(JSON.stringify({ ok: false, code: 'MODEL_NOT_CONFIGURED' }) + '\n');
  process.exit(2);
}
const provider = new DeepSeekProvider({
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
}, async () => saved.apiKey);

const started = Date.now();
try {
  const response = await provider.complete({
    messages: [
      { role: 'system', content: 'You are a concise assistant. Answer in one short sentence.' },
      { role: 'user', content: '用一句中文回答：2+2 等于几？' }
    ],
    tools: [],
    maxOutputTokens: 2048,
    jsonOutput: false
  });
  process.stdout.write(JSON.stringify({
    ok: true,
    providerId: saved.settings.providerId,
    endpoint: saved.settings.endpoint,
    model: response.model,
    content: response.content,
    finishReason: response.finishReason,
    usage: response.usage,
    requestId: response.requestId,
    elapsedMs: Date.now() - started
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({
    ok: false,
    code: error?.code ?? 'MODEL_CALL_FAILED',
    message: error?.message ?? String(error),
    elapsedMs: Date.now() - started
  }) + '\n');
  process.exit(1);
}