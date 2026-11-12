import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract} from '@devmesh/contracts';
import {candidateMaterialKey,candidateMaterialRequests} from './candidate-material-protocol.js';
import type {CandidateMaterial,CandidateMaterialDescriptor,CandidateMaterialInput,CandidateMaterialMethod} from './candidate-material-protocol.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';

type Row=Record<string,string|number|null>;
type Target={operationId:string;ordinal:number;materialKey:string};
function fail(code:string,status=409):never{throw new StorageError(code,status,'Candidate materials require immutable original facts');}
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
export function createCandidateMaterialDomain(db:DatabaseSync){
 const get=(sql:string,...params:SQLInputValue[])=>db.prepare(sql).get(...params) as Row|undefined;
 const all=(sql:string,...params:SQLInputValue[])=>db.prepare(sql).all(...params) as Row[];
 const exec=(sql:string,...params:SQLInputValue[])=>db.prepare(sql).run(...params);
 const integration=(operationId:string)=>get('SELECT * FROM candidate_integrations WHERE operation_id=?',operationId)??fail('CANDIDATE_INTEGRATION_NOT_FOUND',404);
 function member(operationId:string,principalId:string,write:boolean){
  const r=integration(operationId),m=get('SELECT role FROM project_members WHERE project_id=? AND principal_id=?',r.project_id!,principalId);
  if(!m||write&&(m.role==='viewer'||r.principal_id!==principalId))fail('CANDIDATE_MATERIAL_NOT_FOUND',404);return r;
 }
 function bound(i:{operationId:string;principalId:string;ordinal:number;requestHash:string}){
  const r=member(i.operationId,i.principalId,true);if(r.request_hash!==i.requestHash)fail('CANDIDATE_REQUEST_CHANGED');const s=get('SELECT * FROM candidate_integration_steps WHERE operation_id=? AND ordinal=?',i.operationId,i.ordinal)??fail('CANDIDATE_STEP_NOT_FOUND',404);return {r,s};
 }
 const material=(t:Target)=>get('SELECT * FROM candidate_materials WHERE operation_id=? AND ordinal=? AND material_key=?',t.operationId,t.ordinal,t.materialKey)??fail('CANDIDATE_MATERIAL_NOT_FOUND',404);
 const descriptor=(r:Row)=>JSON.parse(String(r.descriptor_json)) as CandidateMaterialDescriptor;
 const view=(r:Row):CandidateMaterial=>({operationId:String(r.operation_id),ordinal:Number(r.ordinal),materialKey:String(r.material_key),descriptor:descriptor(r),writeKey:r.write_key as string|null,contentHash:r.content_hash as string|null,writeId:r.write_id as string|null});
 const rows=(operationId:string,ordinal:number)=>all('SELECT * FROM candidate_materials WHERE operation_id=? AND ordinal=? ORDER BY material_key',operationId,ordinal);
 function report(operationId:string,ordinal:number,hash:string){const r=material({operationId,ordinal,materialKey:'report'}),d=descriptor(r);if(d.kind!=='REPORT'||d.mergeSha256!==hash||!r.content_hash||!get("SELECT 1 FROM content_objects WHERE content_hash=? AND state='READY' AND byte_size=?",r.content_hash,r.byte_size!))fail('CANDIDATE_REPORT_UNAVAILABLE');return r;}
 const manifestHash=(operationId:string,ordinal:number,items:Row[])=>digest(canonical({schemaVersion:'devmesh.candidate-materials.v1',operationId,ordinal,materials:items.map(row=>({materialKey:String(row.material_key),descriptor:descriptor(row)}))}));
 const handlers={
  getCandidateMaterial(i:CandidateMaterialInput<'getCandidateMaterial'>){member(i.operationId,i.principalId,false);const r=get('SELECT * FROM candidate_materials WHERE operation_id=? AND ordinal=? AND material_key=?',i.operationId,i.ordinal,i.materialKey);return r?view(r):null;},
  declareCandidateMaterials(i:CandidateMaterialInput<'declareCandidateMaterials'>){return transaction(db,()=>{
   const {r,s}=bound(i),p=s.preparation_json?JSON.parse(String(s.preparation_json)) as {clean:boolean;reportSha256:string;bases:string[]}:null,result:CandidateMaterial[]=[];
   if(new Set(i.materials.map(candidateMaterialKey)).size!==i.materials.length)fail('CANDIDATE_MATERIAL_DUPLICATE');
   for(const d of i.materials){const key=candidateMaterialKey(d),old=get('SELECT * FROM candidate_materials WHERE operation_id=? AND ordinal=? AND material_key=?',i.operationId,i.ordinal,key);
    if(old){if(!same(descriptor(old),d))fail('CANDIDATE_MATERIAL_IMMUTABLE');result.push(view(old));continue;}
    if(!['BUILDING','CONFLICT_PENDING'].includes(String(r.state)))fail('CANDIDATE_INTEGRATION_CLOSED');
    if(d.kind==='REPORT'){
     if(!['COMPUTING','PREPARED','CONFLICT_PENDING'].includes(String(s.state))||p&&p.reportSha256!==d.mergeSha256)fail('CANDIDATE_REPORT_CHANGED');
    }else{
     if(s.state!=='CONFLICT_PENDING'||!p||p.clean)fail('CANDIDATE_CONFLICT_UNPREPARED');report(i.operationId,i.ordinal,p.reportSha256);
     if(d.version.startsWith('base.')&&!p.bases.includes(d.version.slice(5)))fail('CANDIDATE_CONFLICT_BASE_CHANGED');
     if(d.version.startsWith('stage.')&&d.kind==='DIRECTORY')fail('CANDIDATE_CONFLICT_STAGE_INVALID');
    }
    const content=d.kind==='FILE'||d.kind==='REPORT';exec('INSERT INTO candidate_materials(operation_id,ordinal,material_key,descriptor_json,kind,expected_hash,byte_size,write_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)',i.operationId,i.ordinal,key,canonical(d),d.kind,content?d.sha256:null,content?d.byteSize:null,content?randomUUID():null,new Date().toISOString());result.push(view(material({operationId:i.operationId,ordinal:i.ordinal,materialKey:key})));
   }
   const totals=get('SELECT count(*) n,COALESCE(sum(byte_size),0) bytes FROM candidate_materials WHERE operation_id=? AND ordinal=?',i.operationId,i.ordinal)!;if(Number(totals.n)>20000||Number(totals.bytes)>128*1024*1024)fail('CANDIDATE_MATERIALS_TOO_LARGE');return result;
  });},
  listCandidateMaterials(i:CandidateMaterialInput<'listCandidateMaterials'>){member(i.operationId,i.principalId,false);return all('SELECT * FROM candidate_materials WHERE operation_id=? AND ordinal=? AND material_key>? ORDER BY material_key LIMIT ?',i.operationId,i.ordinal,i.afterKey,i.limit).map(view);},
  sealCandidateConflictMaterials(i:CandidateMaterialInput<'sealCandidateConflictMaterials'>){return transaction(db,()=>{
   const {r,s}=bound(i),old=get('SELECT * FROM candidate_conflict_manifests WHERE operation_id=? AND ordinal=?',i.operationId,i.ordinal);
   if(old){if(old.manifest_hash!==i.manifestSha256||old.material_count!==i.materialCount)fail('CANDIDATE_CONFLICT_IMMUTABLE');return {manifestSha256:i.manifestSha256,materialCount:i.materialCount};}
   if(r.state!=='CONFLICT_PENDING'||s.state!=='CONFLICT_PENDING'||!s.preparation_json)fail('CANDIDATE_CONFLICT_UNPREPARED');const p=JSON.parse(String(s.preparation_json));report(i.operationId,i.ordinal,p.reportSha256);
   const items=rows(i.operationId,i.ordinal);if(items.length!==i.materialCount||manifestHash(i.operationId,i.ordinal,items)!==i.manifestSha256)fail('CANDIDATE_CONFLICT_MANIFEST_CHANGED');
   exec('INSERT INTO candidate_conflict_manifests VALUES(?,?,?,?,?,?)',i.operationId,i.ordinal,p.reportSha256,i.materialCount,i.manifestSha256,new Date().toISOString());return {manifestSha256:i.manifestSha256,materialCount:i.materialCount};
  });},
  acknowledgeCandidateConflict(i:CandidateMaterialInput<'acknowledgeCandidateConflict'>){return transaction(db,()=>{
   const {r,s}=bound(i),manifest=get('SELECT * FROM candidate_conflict_manifests WHERE operation_id=? AND ordinal=?',i.operationId,i.ordinal),proof=i.proof,identity=JSON.parse(String(r.basis_json)).repository.identity;
   if(!manifest||manifest.report_hash!==proof.reportSha256||manifest.manifest_hash!==proof.manifestSha256||manifest.material_count!==proof.materialCount||!same(identity,proof.repositoryIdentity))fail('CANDIDATE_CONFLICT_ACK_UNPROVEN');
   if(r.state==='CONFLICT'&&s.state==='CONFLICT'){if(!same(JSON.parse(String(r.acknowledgement_json)),proof))fail('CANDIDATE_CONFLICT_IMMUTABLE');return {operationId:i.operationId,state:'CONFLICT' as const,acknowledgement:proof};}
   if(r.state!=='CONFLICT_PENDING'||s.state!=='CONFLICT_PENDING')fail('CANDIDATE_CONFLICT_UNPREPARED');
   const items=rows(i.operationId,i.ordinal);if(items.length!==proof.materialCount||manifestHash(i.operationId,i.ordinal,items)!==proof.manifestSha256)fail('CANDIDATE_CONFLICT_MANIFEST_CHANGED');
   for(const row of items)if(['FILE','REPORT'].includes(String(row.kind))&&(!row.content_hash||!get("SELECT 1 FROM content_objects WHERE content_hash=? AND state='READY' AND byte_size=?",row.expected_hash!,row.byte_size!)))fail('CANDIDATE_MATERIAL_UNAVAILABLE');
   const at=new Date().toISOString(),ack=canonical(proof);exec("UPDATE candidate_integration_steps SET state='CONFLICT',acknowledgement_json=?,acknowledged_at=? WHERE operation_id=? AND ordinal=?",ack,at,i.operationId,i.ordinal);exec("UPDATE candidate_integrations SET state='CONFLICT',acknowledgement_json=?,acknowledged_at=?,error_code=NULL WHERE operation_id=?",ack,at,i.operationId);return {operationId:i.operationId,state:'CONFLICT' as const,acknowledgement:proof};
  });},
 };
 return {
  authorize(principalId:string,target:Target){member(target.operationId,principalId,true);const row=material(target);if(!['FILE','REPORT'].includes(String(row.kind)))fail('CANDIDATE_MATERIAL_HAS_NO_BYTES');return row;},
  validateWrite(input:{meta:{principalId:string;scopeId:string;idempotencyKey:string};target:Target;expectedHash:string;expectedSize:number}){const row=this.authorize(input.meta.principalId,input.target);if(input.meta.scopeId!==input.target.operationId||input.meta.idempotencyKey!==row.write_key||input.expectedHash!==row.expected_hash||input.expectedSize!==row.byte_size)fail('CANDIDATE_MATERIAL_WRITE_CHANGED');},
  commit(principalId:string,target:Target,hash:string,writeId:string){const row=this.authorize(principalId,target);if(hash!==row.expected_hash)fail('CANDIDATE_MATERIAL_WRITE_CHANGED');if(row.content_hash&&row.write_id!==writeId)fail('CANDIDATE_MATERIAL_IMMUTABLE');exec('UPDATE candidate_materials SET content_hash=?,write_id=? WHERE operation_id=? AND ordinal=? AND material_key=?',hash,writeId,target.operationId,target.ordinal,target.materialKey);return {operationId:target.operationId,ordinal:target.ordinal,materialKey:target.materialKey,contentHash:hash};},
  resolve(principalId:string,target:Target){member(target.operationId,principalId,false);const row=material(target);if(!row.content_hash)fail('CANDIDATE_MATERIAL_UNAVAILABLE');return {content_hash:row.content_hash};},
  execute(method:CandidateMaterialMethod,input:unknown):unknown{const parsed=parseContract(candidateMaterialRequests[method],input);return (handlers[method] as (input:unknown)=>unknown)(parsed);},
 };
}
