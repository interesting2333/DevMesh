import { existsSync, mkdirSync, readdirSync, readFileSync, openSync, writeFileSync, closeSync, fsyncSync, unlinkSync, linkSync, statSync, renameSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { acquireWriterLock, openStorage } from '@devmesh/storage-sqlite';
import type { SqliteStorage } from '@devmesh/storage-sqlite';
import { canonicalRoot, assertSeparate, fail, safePath } from './paths.js';

export interface StorageConfig {
  dataRoot: string;
  backupRoot: string;
  runnerDataRoot?: string | undefined;
  initialize?: boolean | undefined;
  storeId?: string | undefined;
  recoveryToken?: string | undefined;
  minimumFreeBytes?: number | undefined;
  mode?: 'local' | 'shared' | undefined;
}
const markerSchema = z.strictObject({ layoutVersion:z.literal(1),storeId:z.uuid(),nodeKind:z.literal('control'),createdAt:z.iso.datetime() });
export type LayoutMarker = z.infer<typeof markerSchema>;
export const storageConfigSchema = z.strictObject({ dataRoot:z.string().min(1).default('.devmesh-data/control'),backupRoot:z.string().min(1).default('.devmesh-backups'),runnerDataRoot:z.string().min(1).optional(),initialize:z.boolean().default(false),storeId:z.uuid().optional(),recoveryToken:z.uuid().optional(),minimumFreeBytes:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(64*1024*1024),mode:z.enum(['local','shared']).default('local') });
export function parseStorageConfig(value:unknown,configPath?:string,env:NodeJS.ProcessEnv=process.env):StorageConfig{return resolveStorageConfig(storageConfigSchema.parse(value),configPath,env);}
export interface LocalStorage { storage: SqliteStorage; dataRoot: string; backupRoot: string; marker: LayoutMarker; directorySync: 'supported' | 'unsupported'; minimumFreeBytes: number; close(): Promise<void> }

export function resolveStorageConfig(value: StorageConfig, configPath?: string, env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const base = configPath ? dirname(resolve(configPath)) : process.cwd();
  const result: StorageConfig = { ...value, dataRoot: env.DEVMESH_DATA_ROOT ?? value.dataRoot, backupRoot: env.DEVMESH_BACKUP_ROOT ?? value.backupRoot, runnerDataRoot: env.DEVMESH_RUNNER_DATA_ROOT ?? value.runnerDataRoot };
  for (const key of ['dataRoot','backupRoot','runnerDataRoot'] as const) {
    const path = result[key]; if (!path) continue;
    if (value.mode === 'shared' && !isAbsolute(path)) fail('ROOT_PATH_INVALID','Shared deployment requires absolute paths',422);
    result[key] = resolve(base,path);
  }
  return result;
}
export function syncDirectory(path: string): 'supported' | 'unsupported' {
  let fd: number | undefined;
  try { fd=openSync(path,'r');fsyncSync(fd);return 'supported'; }
  catch(error) { if(process.platform==='win32' && ['EPERM','EISDIR','EINVAL','ENOTSUP','EACCES'].includes((error as NodeJS.ErrnoException).code??''))return 'unsupported';throw error; }
  finally{if(fd!==undefined)closeSync(fd);}
}
export async function checkCapacity(root: string, requestedBytes: number, reserve: number): Promise<number> {
  const disk=await statfs(root,{bigint:true});const available=disk.bavail*disk.bsize;
  if(!Number.isSafeInteger(requestedBytes)||requestedBytes<0||!Number.isSafeInteger(reserve)||reserve<0)fail('CAPACITY_INVALID','Byte budgets must be nonnegative safe integers',422);
  if(available<BigInt(requestedBytes)+BigInt(reserve))fail('STORAGE_CAPACITY','Insufficient disk space including the completion reserve',507);
  return Number(available);
}
export async function openLocalStorage(input: StorageConfig): Promise<LocalStorage> {
  const dataRoot=canonicalRoot(input.dataRoot),backupRoot=canonicalRoot(input.backupRoot);
  assertSeparate([dataRoot,backupRoot,...(input.runnerDataRoot?[canonicalRoot(input.runnerDataRoot)]:[])]);
  if(!existsSync(dataRoot)) {
    if(!input.initialize)fail('STORAGE_NOT_INITIALIZED','Run storage:init explicitly before starting this data root',404);
    mkdirSync(dataRoot,{recursive:true,mode:0o700});
  }
  const lock=acquireWriterLock(dataRoot+'.node',input.recoveryToken);
  let storage: SqliteStorage | undefined;
  try {
    const markerPath=join(dataRoot,'storage-layout.json'),pendingMarker=join(dataRoot,'storage-layout.initializing.json'),hadMarker=existsSync(markerPath),resuming=!hadMarker && existsSync(pendingMarker);
    if(!hadMarker && (!input.initialize || (!resuming && readdirSync(dataRoot).length!==0)))fail('LAYOUT_UNRECOGNIZED','Refusing an unknown or nonempty data directory; incomplete initialization requires explicit storage:init');
    if(resuming){
      safePath(dataRoot,'storage-layout.initializing.json');
      const allowed=new Set(['storage-layout.initializing.json','db','artifacts','repositories','views','staging','logs','cache','manifests','locks','trash']);
      if(readdirSync(dataRoot).some(name=>!allowed.has(name)))fail('LAYOUT_UNRECOGNIZED','Incomplete layout contains unrecognized entries');
    }
    let marker: LayoutMarker;
    if(hadMarker) {
      if(statSync(markerPath).nlink!==1)fail('LAYOUT_UNRECOGNIZED','Layout marker must be a regular independent file');
      // lstat/realpath validation includes marker symlinks as well as its ancestors.
      safePath(dataRoot,'storage-layout.json');
      marker=markerSchema.parse(JSON.parse(readFileSync(markerPath,'utf8')));
      if(input.storeId && marker.storeId!==input.storeId)fail('STORE_IDENTITY_MISMATCH','Configured storeId differs from layout marker');
    } else {
      marker=markerSchema.parse(resuming?JSON.parse(readFileSync(pendingMarker,'utf8')):{layoutVersion:1,storeId:input.storeId??randomUUID(),nodeKind:'control',createdAt:new Date().toISOString()});
      if(input.storeId && marker.storeId!==input.storeId)fail('STORE_IDENTITY_MISMATCH','Initialization identity differs from requested store');
      if(!resuming){const fd=openSync(pendingMarker,'wx',0o600);try{writeFileSync(fd,JSON.stringify(marker,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
      syncDirectory(dataRoot);
    }
    const dirs=['db','artifacts','artifacts/sha256','repositories','views','views/projects','views/sessions','views/invocations','views/exports','staging','staging/uploads','staging/objects','staging/imports','staging/exports','logs','logs/control','cache','manifests','manifests/backups','locks','trash'];
    for(const dir of dirs){const path=join(dataRoot,dir);canonicalRoot(path);if(!existsSync(path))mkdirSync(path,{mode:0o700});}
    if(!existsSync(backupRoot))mkdirSync(backupRoot,{recursive:true,mode:0o700});
    const reserve=input.minimumFreeBytes??64*1024*1024;
    await checkCapacity(dataRoot,0,reserve);
    if(statSync(join(dataRoot,'staging/objects')).dev!==statSync(join(dataRoot,'artifacts')).dev)fail('STORAGE_CROSS_VOLUME','Staging and content must share a filesystem');
    const probe='probe_'+randomUUID().replaceAll('-',''),source=join(dataRoot,'staging/objects',probe),target=join(dataRoot,'artifacts',probe);
    try{const fd=openSync(source,'wx',0o600);try{writeFileSync(fd,'probe');fsyncSync(fd);}finally{closeSync(fd);}linkSync(source,target);}
    finally{if(existsSync(source))unlinkSync(source);if(existsSync(target))unlinkSync(target);}
    const directorySync=syncDirectory(join(dataRoot,'artifacts'));
    const databasePath=join(dataRoot,'db/devmesh.sqlite');
    if(hadMarker && !existsSync(databasePath))fail('DATABASE_NOT_FOUND','Existing layout has no database; refusing implicit recreation',404);
    let databaseRecovery: string | undefined;
    if(input.recoveryToken && existsSync(databasePath+'.writer.lock'))databaseRecovery=(JSON.parse(readFileSync(databasePath+'.writer.lock','utf8')) as {token:string}).token;
    storage=await openStorage({databasePath,storeId:marker.storeId,layoutVersion:1,create:!existsSync(databasePath),backupDirectory:backupRoot,...(databaseRecovery?{recoveryToken:databaseRecovery}:{})});
    await storage.request('recoverContentReads',{});
    if(!hadMarker){renameSync(pendingMarker,markerPath);syncDirectory(dataRoot);}
    let closing: Promise<void> | undefined;
    const client=storage;
    return {storage:client,dataRoot,backupRoot,marker,directorySync,minimumFreeBytes:reserve,close(){return closing??=(async()=>{try{await client.close();}finally{lock.release();}})();}};
  }catch(error){try{await storage?.close();}finally{lock.release();}throw error;}
}
