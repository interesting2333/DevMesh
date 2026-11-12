// Formal candidate/review preparation plus actual file-backed SQLite Worker.
// Human observations, source Git and OCI/container facts are explicit fixtures.
import {backup,DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openStorage} from '../../packages/storage-sqlite/dist/index.mjs';
import {releaseFreezeFixture} from './release-freeze.mjs';
import {meta,hash,canonical} from './storage-data.mjs';
export async function acceptanceFixture(t,{register=true,reviewed=true,...freezeOptions}={}){
  const f=await releaseFreezeFixture(t,freezeOptions),candidate=await f.freeze(),who={principalId:'user_1',runId:f.p.runId,candidateId:candidate.candidateId};
  if(reviewed)for(const item of (await f.storage.request('getCandidateReview',who)).items){const r=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('recordCandidateReview',{meta:meta(f.p.runId),runId:f.p.runId,candidateId:candidate.candidateId,ifMatch:'"r'+r.resourceRevision+'"',manifestHash:candidate.manifestHash,itemId:item.itemId,itemHash:item.itemHash,previousResultId:null,verdict:'PASS',procedure:'Explicit protocol fixture observation.',expected:item.expected,observed:'Explicit fixture passes this item; not a human product acceptance.',evidence:[]});}
  const root=await mkdtemp(join(tmpdir(),'devmesh-acceptance-')),databasePath=join(root,'control.sqlite'),storeId=f.get('SELECT store_id FROM store_metadata').store_id;
  await backup(f.db,databasePath);const db=new DatabaseSync(databasePath);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');let storage=await openStorage({databasePath,storeId});
  t.after(async()=>{await storage.close();db.close();await rm(root,{recursive:true,force:true});});
  const policy={schemaVersion:'devmesh.acceptance-backend.v1',backendPrincipalId:'acceptance.fixture.service',backendRef:'acceptance.fixture.backend',runnerId:'runner.unit',templateVersion:candidate.manifest.templateVersion,schemaRevision:'web-crud-v1.schema.1',initialModes:['EMPTY','DEMO'],allowPreserveMigration:true,allowReplacement:true};
  const registration={principalId:'user_1',projectId:f.p.projectId,policy};let policyHash=hash(canonical(policy));if(register)({policyHash}=await storage.request('registerAcceptanceBackendPolicy',registration));
  const request=async(overrides={})=>{const r=await storage.request('getRun',{runId:f.p.runId}),v=await storage.request('getCandidateReview',who);return {meta:meta(f.p.runId),runId:f.p.runId,candidateId:candidate.candidateId,candidateRevision:candidate.revision,manifestHash:candidate.manifestHash,reviewHash:v.reviewHash,expectedAcceptedReleaseId:null,dataPlanHash:hash(canonical(candidate.manifest.delivery.record.dataPlan)),policyHash,ifMatch:'"r'+r.resourceRevision+'"',...overrides};};
  const api={...f,root,db,candidate,who,policy,policyHash,registration,request,get:(sql,...args)=>db.prepare(sql).get(...args),run:(sql,...args)=>db.prepare(sql).run(...args),call:(method,input)=>storage.request(method,input),async reopen(){await storage.close();storage=await openStorage({databasePath,storeId});},bound:p=>({principalId:policy.backendPrincipalId,operationId:p.operationId,requestHash:p.requestHash,expectedRevision:p.revision})};
  Object.defineProperty(api,'storage',{get:()=>storage});return api;
}
