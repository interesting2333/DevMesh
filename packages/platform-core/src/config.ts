import { readFileSync } from 'node:fs';
import { parseStorageConfig } from '@devmesh/blob-store';
import type { StorageConfig } from '@devmesh/blob-store';

export interface ServerConfig {
  host: '127.0.0.1' | '::1';
  port: number;
  shutdownTimeoutMs: number;
  storage?: Readonly<StorageConfig> | undefined;
  storageSources?: Readonly<Record<string,string>> | undefined;
}

export class ConfigError extends Error {
  readonly code = 'CONFIG_INVALID';
}

function integer(value: unknown, field: string, min: number, max: number): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new ConfigError(`${field} must be an integer in ${min}..${max}`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, configPath?: string): Readonly<ServerConfig> {
  const path = configPath ?? env.DEVMESH_CONFIG;
  let file: Record<string, unknown> = {};
  if (path !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    } catch {
      throw new ConfigError('Cannot read or parse server configuration file');
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ConfigError('Server configuration must be a JSON object');
    }
    for (const key of Object.keys(parsed)) {
      if (!['host', 'port', 'shutdownTimeoutMs', 'storage'].includes(key)) throw new ConfigError(`Unknown server configuration field: ${key}`);
    }
    file = parsed as Record<string, unknown>;
  }
  const host = env.DEVMESH_HOST ?? file.host ?? '127.0.0.1';
  if (host !== '127.0.0.1' && host !== '::1') throw new ConfigError('host must be an explicit loopback address (127.0.0.1 or ::1)');
  let storage: StorageConfig | undefined;
  let storageSources: Record<string,string> | undefined;
  if(file.storage!==undefined || env.DEVMESH_DATA_ROOT!==undefined){
    try{storage=parseStorageConfig(file.storage??{},path,env);}catch(error){throw new ConfigError(error instanceof Error?error.message:'Invalid storage configuration');}
    const fields=file.storage as Record<string,unknown>|undefined;
    storageSources=Object.fromEntries([['dataRoot','DEVMESH_DATA_ROOT'],['backupRoot','DEVMESH_BACKUP_ROOT'],['runnerDataRoot','DEVMESH_RUNNER_DATA_ROOT']].map(([field,key])=>[field,env[key!]!==undefined?'environment':fields?.[field!]!==undefined?'file':field==='runnerDataRoot'?'unset':'local-default']));
  }
  return Object.freeze({
    host,
    port: integer(env.DEVMESH_PORT ?? file.port ?? 3210, 'port', 0, 65535),
    shutdownTimeoutMs: integer(env.DEVMESH_SHUTDOWN_TIMEOUT_MS ?? file.shutdownTimeoutMs ?? 5000, 'shutdownTimeoutMs', 100, 30000),
    ...(storage?{storage:Object.freeze(storage),storageSources:Object.freeze(storageSources!)}:{}),
  });
}
