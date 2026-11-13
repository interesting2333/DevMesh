import {createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {acceptancePreparedProof,canonical} from '@devmesh/storage-sqlite';
import {RunnerError} from './protocol.js';
import {acceptanceProofMigration} from './acceptance-proof-migration.js';
import type {createAcceptanceServiceDomain} from './acceptance-service-domain.js';
import type {StoreInput} from './store-protocol.js';
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
export function createAcceptanceProofDomain(db:DatabaseSync,runnerId:string,services:Pick<ReturnType<typeof createAcceptanceServiceDomain>,'acceptanceServiceGet'|'acceptanceServiceJournal'>){
 const tx=<T>(body:()=>T):T=>{db.exec('BEGIN IMMEDIATE');try{const result=body();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const version=Number(Object.values(db.prepare('PRAGMA user_version').get()!)[0]);
 if(version===7)tx(()=>{db.exec(acceptanceProofMigration);db.prepare('INSERT INTO runner_schema_history VALUES(8,?,?)').run(hash(acceptanceProofMigration),new Date().toISOString());if(db.prepare('PRAGMA foreign_key_check').all().length)throw new RunnerError('RUNNER_MIGRATION_FOREIGN_KEYS',409);});else if(version!==8)throw new RunnerError('RUNNER_STORE_IDENTITY_MISMATCH',409);
 if(db.prepare('SELECT sha256 FROM runner_schema_history WHERE version=8').get()?.sha256!==hash(acceptanceProofMigration)||db.prepare('SELECT version FROM runner_identity').get()?.version!==8)throw new RunnerError('RUNNER_MIGRATION_DRIFT',409);
 return {acceptanceServicePrepareProof(i:StoreInput<'acceptanceServicePrepareProof'>){return tx(()=>{
  const r=services.acceptanceServiceGet(i),old=db.prepare('SELECT * FROM acceptance_service_proofs WHERE reservation_id=?').get(i.reservationId);
  if(old){if(old.request_hash!==i.requestHash||hash(String(old.proof_json))!==old.proof_hash)throw new RunnerError('ACCEPTANCE_SERVICE_PROOF_CHANGED',409);return acceptancePreparedProof.parse(JSON.parse(String(old.proof_json)));}
  const j=services.acceptanceServiceJournal(i),f=r.fact,age=f?Date.now()-Date.parse(f.checkedAt):-1;
  if(!j||r.custodyState!=='RELEASE_HELD'||r.state!=='ACTIVE'||r.releasedAt!==null||!r.claim||!r.claimHash||!f?.endpoint||f.state!=='HEALTHY'||f.instanceId!==r.claim.instanceId||age<0||age>30000)throw new RunnerError('ACCEPTANCE_SERVICE_PROOF_UNAVAILABLE',409);
  const q=r.request.preparation,at=new Date().toISOString(),proof=acceptancePreparedProof.parse({schemaVersion:'devmesh.acceptance-prepared.v1',operationId:q.operationId,requestHash:r.request.acceptanceRequestHash,releaseId:q.releaseId,projectId:q.projectId,runId:q.runId,candidateId:q.candidateId,manifestHash:q.manifestHash,reviewHash:q.reviewHash,dataPlanHash:q.dataPlanHash,runnerId,backendRef:q.backendRef,data:r.request.dataReceipt.data,sourceFence:r.request.fences.sourceFence,targetFence:r.request.fences.targetFence,service:{reservationId:r.reservationId,profileHash:j.profileHash,endpoint:f.endpoint,claim:r.claim,claimHash:r.claimHash,custodyState:'RELEASE_HELD',custodyRevision:r.revision},preparedAt:f.checkedAt}),json=canonical(proof);
  db.prepare('INSERT INTO acceptance_service_proofs VALUES(?,?,?,?,?,?)').run(i.reservationId,i.requestHash,j.profileHash,hash(json),json,at);return proof;
 });}};
}
