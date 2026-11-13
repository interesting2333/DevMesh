import {parentPort,workerData} from 'node:worker_threads';
import {DatabaseSync,backup} from 'node:sqlite';
import {constants,existsSync,lstatSync,openSync,writeFileSync,fsyncSync,closeSync,readFileSync,readdirSync,linkSync,unlinkSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {canonical} from '@devmesh/storage-sqlite';
import type {AcceptancePreparation} from '@devmesh/storage-sqlite';
import {RunnerDatasetPaths} from './dataset-paths.js';
import {acceptanceDataOptions,validateAcceptanceDataset,validateAcceptanceFences,validateAcceptanceMigration} from './acceptance-dataset-backend.js';
import type {AcceptanceDatasetObservation} from './acceptance-dataset-backend.js';
import {acceptanceDatasetJournal,acceptanceDatasetReceipt,datasetHash,readDatasetJson,readDatasetJournal,validateStoredDataset} from './dataset-journal.js';
import type {AcceptanceDatasetFences} from './dataset-journal.js';
import {webCrudDatasetMarker,validateDatasetProfile,initializeDatasetProfile} from './dataset-profile.js';
import {RunnerError} from './protocol.js';

const port=parentPort;if(!port)throw Error('Acceptance data actions require their dedicated Worker');
let sequence=0;
const pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void}>();
port.on('message',(m:{id:number;value?:unknown;error?:{code:string;status:number}})=>{const p=pending.get(m.id);if(!p)return;pending.delete(m.id);if(m.error)p.reject(new RunnerError(m.error.code,m.error.status));else p.resolve(m.value);});
function rpc(action:string){return new Promise<unknown>((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});port!.postMessage({rpc:action,id});});}
function durable(path:string,value:unknown){const fd=openSync(path,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);try{writeFileSync(fd,canonical(value)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
const unknown=(errorCode:string):AcceptanceDatasetObservation=>({state:'UNKNOWN',errorCode});

async function main(){
 const {action,preparation,options:rawOptions,trustedMigrationHashes}=workerData as {action:'preflight'|'prepare'|'inspect';preparation:AcceptancePreparation;options:unknown;trustedMigrationHashes:string[]};
 const options=acceptanceDataOptions.parse(rawOptions),r=validateAcceptanceDataset(preparation,options),paths=new RunnerDatasetPaths(options),target={projectId:r.projectId,datasetId:r.target.datasetId};
  if(existsSync(paths.resolve(target).abortJournalPath)){if(action==='inspect')return unknown('ACCEPTANCE_DATA_ABORT_REQUESTED');throw new RunnerError('ACCEPTANCE_DATA_ABORT_REQUESTED',409);}
 const verify=async(f:AcceptanceDatasetFences,kind:'verify'|'inspect')=>{if(canonical(validateAcceptanceFences(await rpc(kind),preparation))!==canonical(f))throw new RunnerError('ACCEPTANCE_DATA_CUSTODY_CHANGED',409);};
 function source(){
  if(!r.source)return null;
  const p=paths.resolve({projectId:r.projectId,datasetId:r.source.datasetId}),j=readDatasetJournal(p);
  if(j.purpose!=='ACCEPTANCE'||j.projectId!==r.projectId||j.datasetId!==r.source.datasetId||j.storageKey!==r.source.storageKey||j.operationId!==r.source.datasetOperationId||j.releaseId!==r.source.releaseId||j.runnerId!==r.runnerId||j.schemaRevision!==r.source.schemaRevision||j.templateVersion!==r.dataPlan.templateVersion)throw new RunnerError('ACCEPTANCE_DATA_SOURCE_CHANGED',409);
  validateStoredDataset(p,j,options.maximumBytes);return {p,j};
 }
 async function inspect():Promise<AcceptanceDatasetObservation>{
  try{
   const p=paths.resolve(target);if(!existsSync(p.journalPath))return unknown('ACCEPTANCE_DATA_ORIGINAL_NOT_OBSERVED');
   const j=readDatasetJournal(p);
   if(j.purpose!=='ACCEPTANCE'||j.requestHash!==preparation.requestHash||canonical(j.journal.request)!==canonical(r))return unknown('ACCEPTANCE_DATA_ORIGINAL_CHANGED');
   if(![p.fencesPath,p.receiptPath,p.databasePath,p.markerPath].every(existsSync))return unknown('ACCEPTANCE_DATA_ORIGINAL_INCOMPLETE');
   const fences=readDatasetJson(p.fencesPath),f=validateAcceptanceFences(fences.value,preparation),receipt=acceptanceDatasetReceipt.parse(readDatasetJson(p.receiptPath).value);
   if(receipt.fencesHash!==datasetHash(fences.bytes))return unknown('ACCEPTANCE_DATA_CUSTODY_CHANGED');
   await verify(f,'inspect');validateStoredDataset(p,j,options.maximumBytes,true);
   return {state:'MATERIALIZED',receipt};
  }catch(e){return unknown(e instanceof RunnerError?e.code:'ACCEPTANCE_DATA_ORIGINAL_UNVERIFIED');}
 }
 if(action==='inspect')return inspect();
 const existing=paths.resolve(target);
 if(existsSync(existing.journalPath)){if(action==='prepare')return inspect();const j=readDatasetJournal(existing);if(j.purpose!=='ACCEPTANCE'||canonical(j.journal.request)!==canonical(r))throw new RunnerError('ACCEPTANCE_DATA_ORIGINAL_CHANGED',409);return undefined;}
 await rpc('preflight');
 if(r.dataPlan.strategy==='PRESERVE_MIGRATE')validateAcceptanceMigration(await rpc('migration') as Uint8Array,preparation,trustedMigrationHashes);
 source();
 if(action==='preflight')return undefined;
 if(preparation.state!=='SENT')throw new RunnerError('ACCEPTANCE_DATA_DISPATCH_GRANT_REQUIRED',409);
 if(!await rpc('authorize'))throw new RunnerError('ACCEPTANCE_DATA_AUTHORIZATION_CHANGED',409);
 const p=paths.resolve(target,true);
 if(existsSync(p.journalPath))return inspect();
 if(readdirSync(p.directory).length)return unknown('ACCEPTANCE_DATA_UNRECOGNIZED_DIRECTORY');
 const j=acceptanceDatasetJournal.parse({schemaVersion:'devmesh.local-dataset-operation.v2',purpose:'ACCEPTANCE',request:r,requestHash:preparation.requestHash,appDatasetId:randomUUID(),createdAt:new Date().toISOString()});
 function syncParents(){if(process.platform==='win32')return;for(const directory of [paths.root,dirname(p.directory),p.directory]){const fd=openSync(directory,constants.O_RDONLY);try{fsyncSync(fd);}finally{closeSync(fd);}}}
 try{durable(p.journalPath,j);}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')return inspect();throw e;}
 try{
  // Permanent original journal precedes physical custody. An interrupted action
  // remains inspect-only, even when acquisition or publication lost its ACK.
  syncParents();const f=validateAcceptanceFences(await rpc('acquire'),preparation);durable(p.fencesPath,f);syncParents();await verify(f,'verify');
  const fd=openSync(p.stagingPath,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);closeSync(fd);
  const originalSource=source(),s=r.dataPlan.strategy==='PRESERVE_MIGRATE'?originalSource:null;let snapshotAt=new Date().toISOString();
  if(s){
   const db=new DatabaseSync(s.p.databasePath,{readOnly:true,allowExtension:false,enableDoubleQuotedStringLiterals:false});
   try{
    db.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; PRAGMA busy_timeout=1000; BEGIN');validateDatasetProfile(db,s.j.appDatasetId);snapshotAt=new Date().toISOString();
    const pageSize=Number(db.prepare('PRAGMA page_size').get()!.page_size),pages=Number(db.prepare('PRAGMA page_count').get()!.page_count);if(pageSize*pages>options.maximumBytes)throw new RunnerError('DATASET_SIZE_LIMIT',413);
    await backup(db,p.stagingPath,{rate:128,progress({totalPages}){if(totalPages*pageSize>options.maximumBytes)throw new RunnerError('DATASET_SIZE_LIMIT',413);}});
   }finally{db.close();}
  }
  const db=new DatabaseSync(p.stagingPath,{allowExtension:false,enableDoubleQuotedStringLiterals:false});
  try{
   db.exec('PRAGMA trusted_schema=OFF; PRAGMA synchronous=FULL; PRAGMA journal_mode=DELETE');
   if(s){validateDatasetProfile(db,s.j.appDatasetId);db.prepare('UPDATE dataset_identity SET dataset_id=? WHERE singleton=1').run(j.appDatasetId);}
   else initializeDatasetProfile(db,j.appDatasetId,r.dataPlan.initialData!,snapshotAt);
   validateDatasetProfile(db,j.appDatasetId);
  }finally{db.close();}
  const sync=openSync(p.stagingPath,constants.O_RDWR|constants.O_NOFOLLOW);try{if(lstatSync(p.stagingPath).size>options.maximumBytes)throw new RunnerError('DATASET_SIZE_LIMIT',413);fsyncSync(sync);}finally{closeSync(sync);}
  // The final authority read must still match original custody after backup.
  await verify(f,'verify');paths.resolve(target);
  linkSync(p.stagingPath,p.databasePath);unlinkSync(p.stagingPath);
  durable(p.markerPath,webCrudDatasetMarker.parse({kind:'web-crud-dataset',templateId:'web-crud-v1',layoutVersion:1,datasetId:j.appDatasetId}));
  const bytes=readFileSync(p.databasePath),journalBytes=readDatasetJson(p.journalPath,320*1024).bytes,fencesBytes=readDatasetJson(p.fencesPath).bytes;
  const receipt=acceptanceDatasetReceipt.parse({schemaVersion:'devmesh.local-dataset-receipt.v2',purpose:'ACCEPTANCE',operationId:preparation.operationId,requestHash:preparation.requestHash,fencesHash:datasetHash(fencesBytes),data:{datasetId:r.target.datasetId,storageKey:r.target.storageKey,schemaRevision:r.target.schemaRevision,originDatasetId:s?r.source!.datasetId:null,sourceReleaseId:r.expectedAcceptedReleaseId,snapshotAt,sha256:datasetHash(bytes),byteSize:bytes.length,integrity:'ok',journalHash:datasetHash(journalBytes),migrationRef:r.dataPlan.migrationRef}});
  durable(p.receiptPath,receipt);syncParents();return await inspect();
 }catch(e){return unknown(e instanceof RunnerError?e.code:'ACCEPTANCE_DATA_PREPARATION_INTERRUPTED');}
}
try{port.postMessage({value:await main()});}
catch(e){port.postMessage({error:{code:e instanceof RunnerError?e.code:e instanceof z.ZodError?'ACCEPTANCE_DATA_REQUEST_INVALID':'ACCEPTANCE_DATA_BACKEND_FAILURE',status:e instanceof RunnerError?e.status:e instanceof z.ZodError?422:503}});}
finally{port.close();}
