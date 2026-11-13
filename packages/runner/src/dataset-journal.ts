import {DatabaseSync} from 'node:sqlite';
import {constants,openSync,closeSync,fstatSync,lstatSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ids,sha256,timestamp} from '@devmesh/contracts';
import {canonical,datasetPreparationRequest,previewEffectReceipt,acceptancePreparationRequest,acceptancePreparedProof,acceptanceDatasetFences} from '@devmesh/storage-sqlite';
import {webCrudDatasetMarker,validateDatasetProfile} from './dataset-profile.js';
import type {RunnerDatasetPaths} from './dataset-paths.js';
import {RunnerError} from './protocol.js';

export const datasetHash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const previewDatasetJournal=z.strictObject({schemaVersion:z.literal('devmesh.local-dataset-operation.v1'),request:datasetPreparationRequest,requestHash:sha256,appDatasetId:z.uuid(),createdAt:timestamp});
export const previewDatasetReceipt=z.strictObject({schemaVersion:z.literal('devmesh.local-dataset-receipt.v1'),operationId:ids.operation,requestHash:sha256,receipt:previewEffectReceipt});
export const acceptanceDatasetJournal=z.strictObject({schemaVersion:z.literal('devmesh.local-dataset-operation.v2'),purpose:z.literal('ACCEPTANCE'),request:acceptancePreparationRequest,requestHash:sha256,appDatasetId:z.uuid(),createdAt:timestamp});
export {acceptanceDatasetFences};
export const acceptanceDatasetReceipt=z.strictObject({schemaVersion:z.literal('devmesh.local-dataset-receipt.v2'),purpose:z.literal('ACCEPTANCE'),operationId:ids.operation,requestHash:sha256,fencesHash:sha256,data:acceptancePreparedProof.shape.data});
export type AcceptanceDatasetFences=z.output<typeof acceptanceDatasetFences>;
type Paths=ReturnType<RunnerDatasetPaths['resolve']>;

export function readDatasetJson(path:string,maximum=32768){
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const before=fstatSync(fd),named=lstatSync(path);if(!before.isFile()||before.nlink!==1||before.size>maximum||named.isSymbolicLink()||named.dev!==before.dev||named.ino!==before.ino)throw new RunnerError('DATASET_JOURNAL_UNSAFE',409);const bytes=readFileSync(fd),after=fstatSync(fd);if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)throw new RunnerError('DATASET_JOURNAL_UNSAFE',409);return {value:JSON.parse(bytes.toString('utf8')) as unknown,bytes};}finally{closeSync(fd);}
}
export function readDatasetJournal(paths:Paths){
 const raw=readDatasetJson(paths.journalPath,320*1024),legacy=previewDatasetJournal.safeParse(raw.value);
 if(legacy.success){if(raw.bytes.length>32768)throw new RunnerError('DATASET_JOURNAL_UNSAFE',409);const j=legacy.data;if(j.requestHash!==datasetHash(canonical(j.request)))throw new RunnerError('DATASET_ORIGINAL_REQUEST_CHANGED',409);return {purpose:'PREVIEW' as const,journal:j,journalHash:datasetHash(raw.bytes),operationId:j.request.operationId,requestHash:j.requestHash,projectId:j.request.projectId,datasetId:j.request.datasetId,storageKey:j.request.storageKey,schemaRevision:j.request.schemaRevision,templateVersion:j.request.templateVersion,runnerId:j.request.runnerId,backendRef:j.request.backendRef,appDatasetId:j.appDatasetId,releaseId:null};}
 const j=acceptanceDatasetJournal.parse(raw.value);if(j.requestHash!==datasetHash(canonical(j.request)))throw new RunnerError('DATASET_ORIGINAL_REQUEST_CHANGED',409);
 return {purpose:'ACCEPTANCE' as const,journal:j,journalHash:datasetHash(raw.bytes),operationId:j.request.operationId,requestHash:j.requestHash,projectId:j.request.projectId,datasetId:j.request.target.datasetId,storageKey:j.request.target.storageKey,schemaRevision:j.request.target.schemaRevision,templateVersion:j.request.dataPlan.templateVersion,runnerId:j.request.runnerId,backendRef:j.request.backendRef,appDatasetId:j.appDatasetId,releaseId:j.request.releaseId};
}
export function validateStoredDataset(paths:Paths,original:ReturnType<typeof readDatasetJournal>,maximumBytes:number,strictAcceptanceBytes=false){
 const marker=webCrudDatasetMarker.parse(readDatasetJson(paths.markerPath).value);if(marker.datasetId!==original.appDatasetId)throw new RunnerError('DATASET_RECEIPT_CHANGED',409);
 const size=[paths.databasePath,paths.databasePath+'-wal',paths.databasePath+'-shm',paths.databasePath+'-journal'].reduce((n,path)=>n+(existsSync(path)?lstatSync(path).size:0),0);if(size>maximumBytes)throw new RunnerError('DATASET_SIZE_LIMIT',413);
 if(original.purpose==='PREVIEW'){
  const saved=previewDatasetReceipt.parse(readDatasetJson(paths.receiptPath).value),r=saved.receipt,j=original.journal;
  if(saved.operationId!==original.operationId||saved.requestHash!==original.requestHash||r.kind!=='DATASET_READY'||r.datasetId!==original.datasetId||r.storageKey!==original.storageKey||r.originDatasetId!==j.request.sourceDatasetId||r.schemaRevision!==original.schemaRevision)throw new RunnerError('DATASET_RECEIPT_CHANGED',409);
 }else{
   const saved=acceptanceDatasetReceipt.parse(readDatasetJson(paths.receiptPath).value),r=original.journal.request,d=saved.data,fences=readDatasetJson(paths.fencesPath),f=acceptanceDatasetFences.parse(fences.value);
   if(saved.fencesHash!==datasetHash(fences.bytes)||f.operationId!==original.operationId||f.requestHash!==original.requestHash||f.targetFence.datasetId!==original.datasetId||(r.source?f.sourceFence?.datasetId!==r.source.datasetId||f.sourceFence.datasetOperationId!==r.source.datasetOperationId:f.sourceFence!==null))throw new RunnerError('DATASET_RECEIPT_CHANGED',409);
  if(saved.operationId!==original.operationId||saved.requestHash!==original.requestHash||d.datasetId!==original.datasetId||d.storageKey!==original.storageKey||d.schemaRevision!==original.schemaRevision||d.journalHash!==original.journalHash||d.originDatasetId!==(r.dataPlan.strategy==='PRESERVE_MIGRATE'?r.source!.datasetId:null)||d.sourceReleaseId!==r.expectedAcceptedReleaseId||canonical(d.migrationRef)!==canonical(r.dataPlan.migrationRef))throw new RunnerError('DATASET_RECEIPT_CHANGED',409);
  if(strictAcceptanceBytes){
   if(['-wal','-journal'].some(suffix=>existsSync(paths.databasePath+suffix)&&lstatSync(paths.databasePath+suffix).size>0))throw new RunnerError('ACCEPTANCE_DATA_BYTES_CHANGED',409);
   const fd=openSync(paths.databasePath,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=fstatSync(fd),bytes=readFileSync(fd),after=fstatSync(fd);if(stat.size!==d.byteSize||bytes.length!==d.byteSize||datasetHash(bytes)!==d.sha256||stat.size!==after.size||stat.mtimeMs!==after.mtimeMs||stat.ctimeMs!==after.ctimeMs)throw new RunnerError('ACCEPTANCE_DATA_BYTES_CHANGED',409);}finally{closeSync(fd);}
  }
 }
 const db=new DatabaseSync(paths.databasePath,{readOnly:true,allowExtension:false,enableDoubleQuotedStringLiterals:false});try{db.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; PRAGMA busy_timeout=1000');validateDatasetProfile(db,original.appDatasetId);}finally{db.close();}
}
