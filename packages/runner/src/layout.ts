import { existsSync,readdirSync,mkdirSync,readFileSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { canonicalRoot,assertSeparate,safePath } from '@devmesh/blob-store';
import { acquireWriterLock } from '@devmesh/storage-sqlite';
import { opaqueKey } from '@devmesh/contracts';
import { openRunnerStore } from './store.js';
import { RunnerError } from './protocol.js';
const markerSchema=z.strictObject({nodeKind:z.literal('runner'),layoutVersion:z.literal(1),runnerId:opaqueKey});
export interface RunnerLayoutOptions {dataRoot:string;controlDataRoot:string;backupRoot:string;runnerId:string;initialize?:boolean;recoveryToken?:string;layoutRecoveryToken?:string}
export async function openRunnerStorage(input:RunnerLayoutOptions){
 const dataRoot=canonicalRoot(input.dataRoot);assertSeparate([dataRoot,canonicalRoot(input.controlDataRoot),canonicalRoot(input.backupRoot)]);opaqueKey.parse(input.runnerId);
 const markerPath=join(dataRoot,'runner-layout.json'),pendingPath=join(dataRoot,'runner-layout.pending.json'),exists=existsSync(dataRoot),hasMarker=existsSync(markerPath),pending=existsSync(pendingPath);
 if(!hasMarker&&!input.initialize)throw new RunnerError('RUNNER_ROOT_NOT_INITIALIZED',409);
 if(!hasMarker&&exists&&!pending&&readdirSync(dataRoot).length)throw new RunnerError('RUNNER_ROOT_NOT_EMPTY',409);
 if(!exists)mkdirSync(dataRoot,{recursive:true,mode:0o700});
 const lock=acquireWriterLock(join(dataRoot,'runner-layout'),input.layoutRecoveryToken);
 try{
  const marker=hasMarker||pending?markerSchema.parse(JSON.parse(readFileSync(safePath(dataRoot,hasMarker?'runner-layout.json':'runner-layout.pending.json'),'utf8'))):markerSchema.parse({nodeKind:'runner',layoutVersion:1,runnerId:input.runnerId});
  if(marker.runnerId!==input.runnerId)throw new RunnerError('RUNNER_STORE_IDENTITY_MISMATCH',409);
  if(!hasMarker&&!pending){const fd=openSync(pendingPath,'wx',0o600);try{writeFileSync(fd,JSON.stringify(marker)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
  for(const name of ['registry','workspaces','invocations','job-outputs','datasets']){const dir=join(dataRoot,name);canonicalRoot(dir);if(!existsSync(dir))mkdirSync(dir,{mode:0o700});}
  const databasePath=safePath(dataRoot,'registry/runner.sqlite');if(hasMarker&&!existsSync(databasePath))throw new RunnerError('RUNNER_DATABASE_MISSING',409);
  const store=await openRunnerStore({databasePath,runnerId:input.runnerId,initialize:!existsSync(databasePath),...(input.recoveryToken?{recoveryToken:input.recoveryToken}:{})});
  if(!hasMarker)renameSync(pendingPath,markerPath);
  let closing:Promise<void>|undefined;return {store,dataRoot,marker,close(){return closing??=(async()=>{try{await store.close();}finally{lock.release();}})();}};
 }catch(error){lock.release();throw error;}
}
