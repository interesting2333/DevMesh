import {roleOutput} from '@devmesh/contracts';
import type {SqliteStorage,WorkVerification,Request,Results} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';
import {canonical,sha256} from './source.js';
import {VerificationError,parseReportJson} from './json.js';

type Subject={principalId:string;operationId:string;runId:string;attemptId:string;qualityOperationId?:string|null};
export interface WorkVerificationResult {verification:WorkVerification;completion:Results['recordVerifiedWork']|null}
function reject(code:string):never{throw new VerificationError(code);}

/** Reads original artifacts and publishes one immutable assessment before applying it.
 * No model, Job dispatch, command, or caller-supplied success decision is accepted. */
export class WorkVerifier {
 constructor(readonly storage:SqliteStorage,readonly content:LocalContentStore){}
 private completion(row:WorkVerification):Request<'recordVerifiedWork'>{
  const e=row.evaluation;if(!e.outcome||!row.artifactId||!row.contentHash)return reject('WORK_VERIFICATION_NOT_COMPLETABLE');
  return {meta:{principalId:row.principalId,scopeId:row.runId,idempotencyKey:row.completionKey},runId:row.runId,attemptId:row.attemptId,verificationOperationId:row.operationId,outcome:e.outcome,evidence:{artifactId:row.artifactId,sha256:row.contentHash},outputs:e.outputs,codeCommit:e.codeCommit};
 }
 private async originalContent(row:WorkVerification){
  const principalId=row.principalId,ref=row.evaluation.candidate,bytes=await this.content.readBytes(principalId,{kind:'artifact',artifactId:ref.artifactId},2*1024*1024);
  if(sha256(bytes)!==ref.sha256||sha256(canonical(roleOutput.parse(parseReportJson(bytes))))!==ref.sha256)return reject('WORK_VERIFICATION_CANDIDATE_CHANGED');
  if(row.evaluation.qualityOperationId){
   const materials=await this.storage.request('listQualityMaterials',{principalId,operationId:row.evaluation.qualityOperationId,limit:100,afterKey:''});
   for(const material of materials){if(!material.contentHash)return reject('QUALITY_MATERIAL_UNAVAILABLE');const body=await this.content.readBytes(principalId,{kind:'qualityMaterial',operationId:material.operationId,materialKey:material.materialKey},16*1024*1024);if(sha256(body)!==material.contentHash||body.byteLength!==material.descriptor.byteSize)return reject('QUALITY_MATERIAL_BYTES_CHANGED');}
  }
 }
 async verify(input:Subject):Promise<WorkVerificationResult>{
  let row:WorkVerification|undefined;
  try{row=await this.storage.request('getWorkVerification',{principalId:input.principalId,operationId:input.operationId});}catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='WORK_VERIFICATION_NOT_FOUND'))throw error;}
  if(row&&row.principalId!==input.principalId)return reject('WORK_VERIFICATION_NOT_FOUND');
  if(row&&(row.runId!==input.runId||row.attemptId!==input.attemptId||row.evaluation.qualityOperationId!==(input.qualityOperationId??null)))return reject('WORK_VERIFICATION_REQUEST_CHANGED');
  if(row?.state==='APPLIED')return {verification:row,completion:await this.storage.request('recordVerifiedWork',this.completion(row))};
  if(!row){
   const {candidate}=await this.storage.request('getWorkVerificationCandidate',{principalId:input.principalId,runId:input.runId,attemptId:input.attemptId}),bytes=await this.content.readBytes(input.principalId,{kind:'artifact',artifactId:candidate.artifactId},2*1024*1024);
   if(sha256(bytes)!==candidate.sha256)return reject('WORK_VERIFICATION_CANDIDATE_CHANGED');
   row=await this.storage.request('beginWorkVerification',{...input,candidate:roleOutput.parse(parseReportJson(bytes))});
  }
  await this.originalContent(row);
  const body=Buffer.from(canonical(row.evaluation));if(sha256(body)!==row.expectedHash||body.byteLength!==row.byteSize)return reject('WORK_VERIFICATION_RESULT_CHANGED');
  await this.content.put({meta:{principalId:input.principalId,scopeId:row.operationId,idempotencyKey:row.writeKey},expectedHash:row.expectedHash,expectedSize:row.byteSize,mimeType:'application/json',target:{kind:'workVerification',operationId:row.operationId}},body);
  row=await this.storage.request('getWorkVerification',{principalId:input.principalId,operationId:input.operationId});
  if(row.qualification!=='CURRENT')return reject('WORK_VERIFICATION_BASIS_STALE');
  if(!row.evaluation.outcome)return {verification:row,completion:null};
  const completion=await this.storage.request('recordVerifiedWork',this.completion(row));
  return {verification:await this.storage.request('getWorkVerification',{principalId:input.principalId,operationId:input.operationId}),completion};
 }
}
