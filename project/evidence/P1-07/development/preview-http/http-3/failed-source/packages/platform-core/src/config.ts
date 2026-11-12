import { readFileSync } from 'node:fs';
import { parseStorageConfig } from '@devmesh/blob-store';
import type { StorageConfig } from '@devmesh/blob-store';
import { loadInternalA2AConfig } from '@devmesh/a2a-adapter/config';
import type { InternalA2AConfig } from '@devmesh/a2a-adapter';
import { parseRuntimeConfig } from '@devmesh/agent-runtime/config';
import type { RuntimeConfig } from '@devmesh/agent-runtime';
import { isAbsolute } from 'node:path';

export interface ServerConfig {
  host: '127.0.0.1' | '::1';
  port: number;
  shutdownTimeoutMs: number;
  storage?: Readonly<StorageConfig> | undefined;
  storageSources?: Readonly<Record<string,string>> | undefined;
  a2a?:Readonly<InternalA2AConfig>|undefined;
  runtime?:Readonly<RuntimeConfig>|undefined;
  inputApi?:Readonly<{repositoryRoot:string;commit:string;templatePath:string}>|undefined;
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
      if (!['host', 'port', 'shutdownTimeoutMs', 'storage','a2a','runtime','inputApi'].includes(key)) throw new ConfigError(`Unknown server configuration field: ${key}`);
    }
    file = parsed as Record<string, unknown>;
  }
  const host = env.DEVMESH_HOST ?? file.host ?? '127.0.0.1';
  if (host !== '127.0.0.1' && host !== '::1') throw new ConfigError('host must be an explicit loopback address (127.0.0.1 or ::1)');
  let storage: StorageConfig | undefined;
  let storageSources: Record<string,string> | undefined;
  let inputApi:ServerConfig['inputApi'];
  if(file.inputApi!==undefined){
    const item=file.inputApi as Record<string,unknown>;
    if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['enabled','repositoryRoot','commit','templatePath'].includes(k)))throw new ConfigError('Invalid inputApi configuration');
    if(typeof item.enabled!=='boolean')throw new ConfigError('inputApi.enabled must be explicit');
    if(item.enabled){
      if(typeof item.repositoryRoot!=='string'||!isAbsolute(item.repositoryRoot)||typeof item.commit!=='string'||!/^[a-f0-9]{40}$/.test(item.commit))throw new ConfigError('inputApi requires an absolute trusted repositoryRoot and fixed commit');
      const templatePath=item.templatePath??'templates/web-crud-v1';
      if(typeof templatePath!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(templatePath)||templatePath.split('/').includes('..'))throw new ConfigError('Invalid inputApi templatePath');
      inputApi=Object.freeze({repositoryRoot:item.repositoryRoot,commit:item.commit,templatePath});
    }
  }
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
    ...(file.a2a!==undefined?{a2a:Object.freeze(loadInternalA2AConfig(file.a2a,path))}:{}),
    ...(file.runtime!==undefined?{runtime:Object.freeze(parseRuntimeConfig(file.runtime))}:{}),
    ...(inputApi?{inputApi}:{}),
  });
}
