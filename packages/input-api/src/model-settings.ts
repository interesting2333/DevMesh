import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { StorageError } from '@devmesh/storage-sqlite';
import { opaqueKey,modelApiBase } from '@devmesh/contracts';

export type ModelSettingsInput = { providerId: string; endpoint: string; model: string; apiKey?: string | undefined };
export type ModelSettingsView = {
  configured: boolean;
  providerId: string | null;
  endpoint: string | null;
  model: string | null;
  hasApiKey: boolean;
  updatedAt: string | null;
};
export type ModelTestResult = { ok: boolean; status: number | null; message: string };
export type ModelConnectionInput = Omit<ModelSettingsInput, 'model'>;
export type ModelListResult = ModelTestResult & { models: string[] };
type StoredSettings = { providerId: string; endpoint: string; model: string; updatedAt: string };

const fileMode = 0o600;
const directoryMode = 0o700;

function validateProvider(providerId: string): string {
  const value = providerId.trim();
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(value)) throw new StorageError('MODEL_SETTINGS_INVALID', 422, 'Provider id is not acceptable');
  return value;
}

function validateKey(value: string | undefined): string | undefined {
  const key = value?.trim();
  if (key && (key.length > 500 || /[\r\n]/.test(key))) throw new StorageError('MODEL_KEY_INVALID', 422, 'API key is not acceptable');
  return key || undefined;
}

function normalizeEndpoint(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new StorageError('MODEL_ENDPOINT_INVALID', 422, 'Endpoint must be a valid URL'); }
  if (url.username || url.password || url.search || url.hash) throw new StorageError('MODEL_ENDPOINT_INVALID', 422, 'Endpoint must not contain credentials, query or fragment');
  const loopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new StorageError('MODEL_ENDPOINT_INVALID', 422, 'Endpoint must use https (http is allowed only on loopback)');
  if (url.pathname === '/') url.pathname = '';
  return modelApiBase(url.toString());
}

export function createModelSettingsStore(root: string) {
  const settingsPath = join(root, 'model.json');
  const secretPath = join(root, 'model-secret.json');

  const ensureDirectory = () => {
    mkdirSync(root, { recursive: true, mode: directoryMode });
    chmodSync(root, directoryMode);
  };
  const writeAtomic = (path: string, value: unknown, mode = fileMode) => {
    ensureDirectory();
    const temporary = join(root, `.${randomUUID()}.tmp`);
    writeFileSync(temporary, JSON.stringify(value) + '\n', { mode });
    chmodSync(temporary, mode);
    renameSync(temporary, path);
  };
  const readJson = <T>(path: string): T | null => {
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { throw new StorageError('MODEL_SETTINGS_CORRUPT', 500, 'Local model settings are unreadable'); }
  };
  const readSecret = (): string | null => {
    const stored = readJson<{ apiKey?: unknown }>(secretPath);
    return stored && typeof stored.apiKey === 'string' && stored.apiKey.length > 0 ? stored.apiKey : null;
  };
  const readSettings = (): StoredSettings | null => {const stored=readJson<StoredSettings>(settingsPath);return stored?{...stored,endpoint:normalizeEndpoint(stored.endpoint)}:null;};

  const view = (settings: StoredSettings | null, hasApiKey: boolean): ModelSettingsView => ({
    configured: settings !== null && hasApiKey,
    providerId: settings?.providerId ?? null,
    endpoint: settings?.endpoint ?? null,
    model: settings?.model ?? null,
    hasApiKey,
    updatedAt: settings?.updatedAt ?? null
  });

  return {
    path: settingsPath,
    async getView(): Promise<ModelSettingsView> {
      return view(readSettings(), readSecret() !== null);
    },
    async save(input: ModelSettingsInput): Promise<ModelSettingsView> {
      const providerId = validateProvider(input.providerId), model = input.model.trim();
      if (!opaqueKey.safeParse(model).success) throw new StorageError('MODEL_SETTINGS_INVALID', 422, 'Model id is not acceptable');
      const endpoint = normalizeEndpoint(input.endpoint);
      const apiKey = validateKey(input.apiKey);
      const existingKey = readSecret();
      if (!apiKey && !existingKey) throw new StorageError('MODEL_KEY_REQUIRED', 422, 'An API key is required for the first save');
      const settings: StoredSettings = { providerId, endpoint, model, updatedAt: new Date().toISOString() };
      writeAtomic(settingsPath, settings);
      if (apiKey) writeAtomic(secretPath, { apiKey });
      else if (existsSync(secretPath)) chmodSync(secretPath, fileMode);
      return view(settings, readSecret() !== null);
    },
    async listModels(input: ModelConnectionInput): Promise<ModelListResult> {
      const providerId = validateProvider(input.providerId), endpoint = normalizeEndpoint(input.endpoint);
      const settings = readSettings();
      const apiKey = validateKey(input.apiKey) ?? (settings?.providerId === providerId && normalizeEndpoint(settings.endpoint) === endpoint ? readSecret() : null);
      if (!apiKey) throw new StorageError('MODEL_KEY_REQUIRED', 422, 'Provide an API key for this connection before listing models');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch(endpoint + '/models', { headers: { authorization: `Bearer ${apiKey}` }, signal: controller.signal, redirect: 'error' });
        if (!response.ok) {
          await response.body?.cancel();
          return { ok: false, status: response.status, models: [], message: `获取模型失败（HTTP ${response.status}），可手动输入模型 ID。` };
        }
        const chunks: Uint8Array[] = [];
        let size = 0;
        const reader = response.body?.getReader();
        if (reader) {
          try {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              size += chunk.value.byteLength;
              if (size > 1024 * 1024) {
                await reader.cancel();
                return { ok: false, status: response.status, models: [], message: '模型列表过大，请手动输入模型 ID。' };
              }
              chunks.push(chunk.value);
            }
          } finally { reader.releaseLock(); }
        }
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { data?: unknown } | null;
        if (!payload || !Array.isArray(payload.data)) return { ok: false, status: response.status, models: [], message: '服务商未返回有效模型列表，请手动输入模型 ID。' };
        const models = [...new Set(payload.data.flatMap(item => {
          const id: unknown = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
          return typeof id === 'string' && opaqueKey.safeParse(id).success && !id.includes(apiKey) ? [id] : [];
        }))].slice(0, 1000);
        return { ok: true, status: response.status, models, message: models.length ? `已获取 ${models.length} 个模型。` : '服务商未返回可选模型，可手动输入模型 ID。' };
      } catch {
        return { ok: false, status: null, models: [], message: '无法获取模型列表或请求超时，可重试或手动输入模型 ID。' };
      } finally { clearTimeout(timer); }
    },
    async test(): Promise<ModelTestResult> {
      const settings = readSettings(), apiKey = readSecret();
      if (!settings || !apiKey) throw new StorageError('MODEL_KEY_REQUIRED', 422, 'Configure the provider and API key before testing');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch(settings.endpoint + '/models', { headers: { authorization: `Bearer ${apiKey}` }, signal: controller.signal });
        return { ok: response.ok, status: response.status, message: response.ok ? '连接成功' : `Provider 返回 ${response.status}` };
      } catch {
        return { ok: false, status: null, message: '连接失败或超时' };
      } finally {
        clearTimeout(timer);
      }
    },
    async readForRuntime(): Promise<{ settings: StoredSettings; apiKey: string } | null> {
      const settings = readSettings(), apiKey = readSecret();
      if (!settings || !apiKey) return null;
      try { if ((statSync(secretPath).mode & 0o077) !== 0) chmodSync(secretPath, fileMode); } catch { /* mode best effort */ }
      return { settings, apiKey };
    }
  };
}

export function removeModelSettings(root: string): void {
  for (const name of ['model.json', 'model-secret.json']) {
    try { unlinkSync(join(root, name)); } catch { /* already absent */ }
  }
}
