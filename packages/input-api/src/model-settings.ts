import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { StorageError } from '@devmesh/storage-sqlite';

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
type StoredSettings = { providerId: string; endpoint: string; model: string; updatedAt: string };

const fileMode = 0o600;
const directoryMode = 0o700;

function normalizeEndpoint(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new StorageError('MODEL_ENDPOINT_INVALID', 422, 'Endpoint must be a valid URL'); }
  if (url.username || url.password || url.search || url.hash) throw new StorageError('MODEL_ENDPOINT_INVALID', 422, 'Endpoint must not contain credentials, query or fragment');
  const loopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new StorageError('MODEL_ENDPOINT_INVALID', 422, 'Endpoint must use https (http is allowed only on loopback)');
  if (url.pathname === '/') url.pathname = '';
  return url.toString().replace(/\/$/, '');
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
  const readSettings = (): StoredSettings | null => readJson<StoredSettings>(settingsPath);

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
      const providerId = input.providerId.trim(), model = input.model.trim();
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(providerId)) throw new StorageError('MODEL_SETTINGS_INVALID', 422, 'Provider id is not acceptable');
      if (!/^[A-Za-z0-9._:-]{1,128}$/.test(model)) throw new StorageError('MODEL_SETTINGS_INVALID', 422, 'Model id is not acceptable');
      const endpoint = normalizeEndpoint(input.endpoint);
      const apiKey = input.apiKey?.trim();
      const existingKey = readSecret();
      if (!apiKey && !existingKey) throw new StorageError('MODEL_KEY_REQUIRED', 422, 'An API key is required for the first save');
      if (apiKey && (apiKey.length > 500 || /[\r\n]/.test(apiKey))) throw new StorageError('MODEL_KEY_INVALID', 422, 'API key is not acceptable');
      const settings: StoredSettings = { providerId, endpoint, model, updatedAt: new Date().toISOString() };
      writeAtomic(settingsPath, settings);
      if (apiKey) writeAtomic(secretPath, { apiKey });
      else if (existsSync(secretPath)) chmodSync(secretPath, fileMode);
      return view(settings, readSecret() !== null);
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