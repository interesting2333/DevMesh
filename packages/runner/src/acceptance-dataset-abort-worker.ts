import {parentPort,workerData} from 'node:worker_threads';
import {constants,openSync,writeFileSync,fsyncSync,closeSync,existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {z} from 'zod';
import {canonical} from '@devmesh/storage-sqlite';
import {acceptanceDatasetAbortOptions} from './acceptance-dataset-abort-backend.js';
import {acceptanceDatasetAbortRequest,acceptanceDatasetAbortJournal,acceptanceDatasetAbortReceipt,validateDatasetAbortJournal,validateDatasetAbortProof,validateOriginalAbortFences} from './acceptance-dataset-abort.js';
import type {AcceptanceDatasetAbortJournal,AcceptanceDatasetAbortObservation} from './acceptance-dataset-abort.js';
import {RunnerDatasetPaths} from './dataset-paths.js';
import {acceptanceDatasetFences,readDatasetJournal,readDatasetJson,datasetHash} from './dataset-journal.js';
import {RunnerError} from './protocol.js';
const port=parentPort;if(!port)throw Error('Data abort requires its dedicated Worker');
let sequence=0;const pending=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void}>();
port.on('message',(m:{id:number;value?:unknown;error?:{code:string;status:number}})=>{const p=pending.get(m.id);if(!p)return;pending.delete(m.id);if(m.error)p.reject(new RunnerError(m.error.code,m.error.status));else p.resolve(m.value);});
function rpc(action:string,journal?:AcceptanceDatasetAbortJournal){return new Promise<unknown>((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});port!.postMessage({rpc:action,id,journal});});}
function durable(path:string,value:unknown){const fd=openSync(path,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);try{writeFileSync(fd,canonical(value)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
const unknown=(errorCode:string):AcceptanceDatasetAbortObservation=>({state:'UNKNOWN',errorCode});
async function main():Promise<AcceptanceDatasetAbortObservation>{
 const request=acceptanceDatasetAbortRequest.parse(workerData.request),options=acceptanceDatasetAbortOptions.parse(workerData.options),r=request.decision.preparation,paths=new RunnerDatasetPaths(options),target={projectId:r.projectId,datasetId:r.target.datasetId};
 let p=paths.resolve(target);
 function sync(){if(process.platform==='win32')return;for(const path of [paths.root,dirname(p.directory),p.directory]){const fd=openSync(path,constants.O_RDONLY);try{fsyncSync(fd);}finally{closeSync(fd);}}}
 function original(){let journalHash:string|null=null;if(existsSync(p.journalPath)){const original=readDatasetJournal(p);if(original.purpose!=='ACCEPTANCE'||original.requestHash!==request.decision.preparationRequestHash||canonical(original.journal.request)!==canonical(r))throw new RunnerError('ACCEPTANCE_DATA_ABORT_IDENTITY_CHANGED',409);journalHash=original.journalHash;}else if([p.databasePath,p.markerPath,p.receiptPath,p.stagingPath].some(existsSync))throw new RunnerError('ACCEPTANCE_DATA_ABORT_ORIGINAL_UNVERIFIED',409);const fences=existsSync(p.fencesPath)?acceptanceDatasetFences.parse(readDatasetJson(p.fencesPath).value):null;if(fences&&!journalHash)throw new RunnerError('ACCEPTANCE_DATA_ABORT_CUSTODY_CHANGED',409);return {journalHash,fences};}
 function read(){const raw=readDatasetJson(p.abortJournalPath,512*1024),j=validateDatasetAbortJournal(raw.value);if(canonical(j.request)!==canonical(request))throw new RunnerError('ACCEPTANCE_DATA_ABORT_IDENTITY_CHANGED',409);const o=original();if(j.originalJournalHash!==null&&j.originalJournalHash!==o.journalHash||j.originalFences!==null&&canonical(j.originalFences)!==canonical(o.fences))throw new RunnerError('ACCEPTANCE_DATA_ABORT_CUSTODY_CHANGED',409);validateOriginalAbortFences(o.fences,j);return {j,bytes:raw.bytes,fences:o.fences};}
 async function inspect():Promise<AcceptanceDatasetAbortObservation>{
  const {j,bytes,fences}=read(),raw=await rpc('inspectAbort',j);if(raw===null)return unknown('ACCEPTANCE_DATA_ABORT_ORIGINAL_UNRESOLVED');const proof=validateDatasetAbortProof(raw,j);if(fences&&canonical(fences)!==canonical(proof.originalFences))throw new RunnerError('ACCEPTANCE_DATA_ABORT_CUSTODY_CHANGED',409);
  const receipt=acceptanceDatasetAbortReceipt.parse({schemaVersion:'devmesh.local-dataset-abort-receipt.v1',requestHash:j.requestHash,journalHash:datasetHash(bytes),proof});
  if(existsSync(p.abortReceiptPath)){if(canonical(acceptanceDatasetAbortReceipt.parse(readDatasetJson(p.abortReceiptPath,512*1024).value))!==canonical(receipt))throw new RunnerError('ACCEPTANCE_DATA_ABORT_RECEIPT_CHANGED',409);}else{try{durable(p.abortReceiptPath,receipt);sync();}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;if(canonical(readDatasetJson(p.abortReceiptPath,512*1024).value)!==canonical(receipt))throw new RunnerError('ACCEPTANCE_DATA_ABORT_RECEIPT_CHANGED',409);}}
  return {state:'RESTORED_CLOSED',receipt};
 }
 try{
  if(existsSync(p.abortJournalPath))return await inspect();
  if(existsSync(p.abortReceiptPath))return unknown('ACCEPTANCE_DATA_ABORT_ORIGINAL_UNVERIFIED');
  if(!await rpc('authorize'))return unknown('ACCEPTANCE_DATA_ABORT_AUTHORIZATION_CHANGED');p=paths.resolve(target,true);const o=original(),j=validateDatasetAbortJournal(acceptanceDatasetAbortJournal.parse({schemaVersion:'devmesh.local-dataset-abort-operation.v1',request,requestHash:datasetHash(canonical(request)),originalJournalHash:o.journalHash,originalFences:o.fences,createdAt:new Date().toISOString()}));
  try{durable(p.abortJournalPath,j);sync();}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')return await inspect();throw e;}
  if(!await rpc('authorize'))return unknown('ACCEPTANCE_DATA_ABORT_AUTHORIZATION_CHANGED');await rpc('abort',j);return await inspect();
 }catch(e){return unknown(e instanceof RunnerError?e.code:'ACCEPTANCE_DATA_ABORT_ORIGINAL_UNVERIFIED');}
}
try{port.postMessage({value:await main()});}catch(e){port.postMessage({error:{code:e instanceof RunnerError?e.code:e instanceof z.ZodError?'ACCEPTANCE_DATA_ABORT_REQUEST_INVALID':'ACCEPTANCE_DATA_ABORT_BACKEND_FAILURE',status:e instanceof RunnerError?e.status:e instanceof z.ZodError?422:503}});}finally{port.close();}
