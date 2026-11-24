import { readFileSync } from 'node:fs';
import { parseStorageConfig } from '@devmesh/blob-store';
import type { StorageConfig } from '@devmesh/blob-store';
import { loadInternalA2AConfig } from '@devmesh/a2a-adapter/config';
import type { InternalA2AConfig } from '@devmesh/a2a-adapter';
import { parseRuntimeConfig } from '@devmesh/agent-runtime/config';
import type { RuntimeConfig } from '@devmesh/agent-runtime';
import { isAbsolute } from 'node:path';
import type {ReleaseExportSchedulerOptions} from './release-exports.js';
import type {McpEndpointPolicy} from '@devmesh/mcp-tools';

export interface ServerConfig {
  host: '127.0.0.1' | '::1';
  port: number;
  shutdownTimeoutMs: number;
  storage?: Readonly<StorageConfig> | undefined;
  storageSources?: Readonly<Record<string,string>> | undefined;
  a2a?:Readonly<InternalA2AConfig>|undefined;
  runtime?:Readonly<RuntimeConfig>|undefined;
  assistant?:Readonly<{enabled:boolean;backend:'disabled'|'docker-development';imageDigest?:string;timeoutMs:number}>|undefined;
  inputApi?:Readonly<{repositoryRoot:string;commit:string;templatePath:string;conversationAdmission?:boolean;workspaceRoots?:readonly string[]}>|undefined;
  releaseExports?:Readonly<ReleaseExportSchedulerOptions>|undefined;
  mcp?:Readonly<{ administrator: string; endpoints?: readonly McpEndpointPolicy[] }>|undefined;
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
      if (!['host', 'port', 'shutdownTimeoutMs', 'storage','a2a','runtime','inputApi','releaseExports','assistant','mcp'].includes(key)) throw new ConfigError(`Unknown server configuration field: ${key}`);
    }
    file = parsed as Record<string, unknown>;
  }
  const host = env.DEVMESH_HOST ?? file.host ?? '127.0.0.1';
  if (host !== '127.0.0.1' && host !== '::1') throw new ConfigError('host must be an explicit loopback address (127.0.0.1 or ::1)');
  let storage: StorageConfig | undefined;
  let storageSources: Record<string,string> | undefined;
  let inputApi:ServerConfig['inputApi'];
  let releaseExports:ServerConfig['releaseExports'];
  let mcp: ServerConfig['mcp'];
  if (file.mcp !== undefined) {
    const item = file.mcp as Record<string, unknown>;
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      Object.keys(item).some(key => !['administrator', 'endpoints'].includes(key)) ||
      typeof item.administrator !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(item.administrator) ||
      (item.endpoints !== undefined && (!Array.isArray(item.endpoints) || item.endpoints.length > 12))) {
      throw new ConfigError('Invalid MCP administrator or endpoint policies');
    }
    mcp = Object.freeze({ administrator: item.administrator, ...(item.endpoints ? { endpoints: item.endpoints as McpEndpointPolicy[] } : {}) });
  }
  if(file.releaseExports!==undefined){
    const item=file.releaseExports as Record<string,unknown>;
    if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['enabled','pollIntervalMs','maxConcurrentJobs','maxJobsPerPass'].includes(k)))throw new ConfigError('Invalid releaseExports configuration');
    if(typeof item.enabled!=='boolean')throw new ConfigError('releaseExports.enabled must be explicit');
    const limits={pollIntervalMs:integer(item.pollIntervalMs??1000,'releaseExports.pollIntervalMs',100,60000),maxConcurrentJobs:integer(item.maxConcurrentJobs??2,'releaseExports.maxConcurrentJobs',1,2),maxJobsPerPass:integer(item.maxJobsPerPass??32,'releaseExports.maxJobsPerPass',1,200)};
    if(item.enabled)releaseExports=Object.freeze(limits);
  }
  if(file.inputApi!==undefined){
    const item=file.inputApi as Record<string,unknown>;
    if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['enabled','repositoryRoot','commit','templatePath','conversationAdmission','workspaceRoots'].includes(k)))throw new ConfigError('Invalid inputApi configuration');
    if(item.conversationAdmission!==undefined&&typeof item.conversationAdmission!=='boolean')throw new ConfigError('inputApi.conversationAdmission must be boolean');
    if(typeof item.enabled!=='boolean')throw new ConfigError('inputApi.enabled must be explicit');
    if(item.enabled){
      if(typeof item.repositoryRoot!=='string'||!isAbsolute(item.repositoryRoot)||typeof item.commit!=='string'||!/^[a-f0-9]{40}$/.test(item.commit))throw new ConfigError('inputApi requires an absolute trusted repositoryRoot and fixed commit');
      const templatePath=item.templatePath??'templates/web-crud-v1';
      if(typeof templatePath!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(templatePath)||templatePath.split('/').includes('..'))throw new ConfigError('Invalid inputApi templatePath');
      if(item.workspaceRoots!==undefined&&(!Array.isArray(item.workspaceRoots)||item.workspaceRoots.length>20||item.workspaceRoots.some(root=>typeof root!=='string'||!isAbsolute(root))))throw new ConfigError('workspaceRoots must contain trusted absolute directories');
      inputApi=Object.freeze({...(item.workspaceRoots?{workspaceRoots:Object.freeze([...(item.workspaceRoots as string[])])}:{}),repositoryRoot:item.repositoryRoot,commit:item.commit,templatePath,...(item.conversationAdmission===undefined?{}:{conversationAdmission:item.conversationAdmission})});
    }
  }
  if(file.storage!==undefined || env.DEVMESH_DATA_ROOT!==undefined){
    try{storage=parseStorageConfig(file.storage??{},path,env);}catch(error){throw new ConfigError(error instanceof Error?error.message:'Invalid storage configuration');}
    const fields=file.storage as Record<string,unknown>|undefined;
    storageSources=Object.fromEntries([['dataRoot','DEVMESH_DATA_ROOT'],['backupRoot','DEVMESH_BACKUP_ROOT'],['runnerDataRoot','DEVMESH_RUNNER_DATA_ROOT']].map(([field,key])=>[field,env[key!]!==undefined?'environment':fields?.[field!]!==undefined?'file':field==='runnerDataRoot'?'unset':'local-default']));
  }
  let assistant:ServerConfig['assistant'];if(file.assistant!==undefined){const a=file.assistant as Record<string,unknown>;if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['enabled','backend','imageDigest','timeoutMs'].includes(k))||typeof a.enabled!=='boolean'||!['disabled','docker-development'].includes(String(a.backend))||a.imageDigest!==undefined&&(typeof a.imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/.test(a.imageDigest))||a.backend==='docker-development'&&!a.imageDigest)throw new ConfigError('Invalid assistant execution configuration');assistant=Object.freeze({enabled:a.enabled,backend:a.backend as 'disabled'|'docker-development',...(a.imageDigest?{imageDigest:a.imageDigest as string}:{}),timeoutMs:integer(a.timeoutMs??120000,'assistant.timeoutMs',1000,300000)});}
  return Object.freeze({
    host,
    port: integer(env.DEVMESH_PORT ?? file.port ?? 3210, 'port', 0, 65535),
    shutdownTimeoutMs: integer(env.DEVMESH_SHUTDOWN_TIMEOUT_MS ?? file.shutdownTimeoutMs ?? 5000, 'shutdownTimeoutMs', 100, 30000),
    ...(storage?{storage:Object.freeze(storage),storageSources:Object.freeze(storageSources!)}:{}),
    ...(file.a2a!==undefined?{a2a:Object.freeze(loadInternalA2AConfig(file.a2a,path))}:{}),
    ...(file.runtime!==undefined?{runtime:Object.freeze(parseRuntimeConfig(file.runtime))}:{}),
    ...(inputApi?{inputApi}:{}),
    ...(assistant?{assistant}:{}),
    ...(mcp?{mcp}:{}),
    ...(releaseExports?{releaseExports}:{}),
  });
}
