import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract,releaseDeliveryPolicy,previewImageLimits} from '@devmesh/contracts';
import type {DeliveryDataPlan} from '@devmesh/contracts';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
import {releaseDeliveryRequests} from './release-delivery-protocol.js';
import type {ReleaseDeliveryMethod,ReleaseDeliveryInput,ReleaseDelivery,ReleaseDeliveryBasis,ReleaseDeliveryMaterial} from './release-delivery-protocol.js';
import type {createQualityDomain} from './quality-domain.js';
import type {PipelineInput} from './pipeline-protocol.js';
type Row=Record<string,string|number|null>;
type Begin=ReleaseDeliveryInput<'beginReleaseDelivery'>;
type Target={operationId:string;materialKey:string};
const json=<T>(v:unknown):T=>JSON.parse(String(v)) as T;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Release delivery requires the original approved build and exact retained bytes');}
export function createReleaseDeliveryDomain(db:DatabaseSync,quality?:Pick<ReturnType<typeof createQualityDomain>,'completionFacts'>){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[],exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
 function member(principalId:string,projectId:string,write=false){const r=get('SELECT p.*,m.role FROM projects p JOIN project_members m ON m.project_id=p.project_id AND m.principal_id=? WHERE p.project_id=?',principalId,projectId);if(!r||write&&(r.owner_id!==principalId||r.role!=='owner'))fail('RELEASE_DELIVERY_NOT_FOUND',404);return r;}
 const record=(id:string)=>get('SELECT * FROM release_deliveries WHERE operation_id=?',id)??fail('RELEASE_DELIVERY_NOT_FOUND',404);
 function owned(principalId:string,id:string,write=false){const r=record(id);member(principalId,String(r.project_id),write);if(write&&r.principal_id!==principalId)fail('RELEASE_DELIVERY_NOT_FOUND',404);return r;}
 function bound(i:{principalId:string;operationId:string;requestHash:string}){const r=owned(i.principalId,i.operationId,true);if(r.request_hash!==i.requestHash)fail('RELEASE_DELIVERY_REQUEST_CHANGED');return r;}
 const policy=(projectId:string,hash:string)=>releaseDeliveryPolicy.parse(json(get('SELECT policy_json FROM release_delivery_policies WHERE project_id=? AND policy_hash=?',projectId,hash)?.policy_json??fail('RELEASE_DELIVERY_POLICY_MISSING')));
 function freeze(i:Begin){
  const run=get('SELECT * FROM runs WHERE run_id=?',i.runId)??fail('RELEASE_DELIVERY_NOT_FOUND',404),project=member(i.principalId,String(run.project_id),true),p=policy(String(run.project_id),i.policyHash);
  if(!quality)fail('RELEASE_DELIVERY_QUALITY_REQUIRED');const qrow=get('SELECT attempt_id FROM quality_verifications WHERE operation_id=? AND run_id=?',i.qualityOperationId,i.runId)??fail('RELEASE_DELIVERY_QUALITY_REQUIRED'),q=quality.completionFacts(i.qualityOperationId,i.principalId,String(qrow.attempt_id)),v=q.verification,b=v.basis;
  const {schemaVersion:_version,templateVersion:_template,checkConfigHash:_config,...profile}=p;
   if(v.evaluation?.automaticStatus!=='PASS'||v.configHash!==p.checkConfigHash||q.policy.templateVersion!==p.templateVersion||!q.policy.delivery||canonical(q.policy.delivery)!==canonical(profile))fail('RELEASE_DELIVERY_POLICY_CHANGED');
  const origin=v.origins.find(o=>o.producerId===p.producerId),stage=origin?get('SELECT job_json FROM pipeline_stages WHERE pipeline_id=? AND ordinal=?',origin.pipelineId,origin.ordinal):undefined;
  if(!origin||!stage?.job_json)fail('RELEASE_DELIVERY_BUILD_MISSING');
  const job=json<PipelineInput<'recordPipelineStage'>['job']>(stage.job_json),spec=job.request.outputSpec;
  if(job.state!=='EXITED'||job.exitCode!==0||job.errorCode||job.stopRequested||!Array.isArray(spec)||!job.executionProfile||!job.startedAt||!job.endedAt)fail('RELEASE_DELIVERY_BUILD_UNPROVEN');
  const materials=p.materials.map(m=>{const index=spec.indexOf(m.path),output=job.outputRefs[index+1];if(index<0||index>=32||!output||output.byteSize>previewImageLimits.blobBytes)fail('RELEASE_DELIVERY_MATERIAL_MISSING');return {materialKey:m.key,path:m.path,outputIndex:index+1,expectedHash:output.sha256,byteSize:output.byteSize};});
  if(materials.reduce((n,m)=>n+m.byteSize,0)>previewImageLimits.totalBytes)fail('RELEASE_DELIVERY_MATERIAL_LIMIT');
  const result=q.materials.find(m=>m.materialKey==='result')?.contentHash;if(!result)fail('RELEASE_DELIVERY_QUALITY_REQUIRED');
  const basis:ReleaseDeliveryBasis={runId:i.runId,runEpoch:b.runEpoch,planRevision:b.planRevision,requirementRevision:b.requirementRevision,targetCommit:b.targetCommit,sourceManifestSha256:b.allocationManifestSha256,checkConfigHash:v.configHash,templateVersion:p.templateVersion,qualityOperationId:i.qualityOperationId,qualityBasisSha256:digest(canonical(b)),qualityResultHash:result,attemptId:b.attemptId,workEpoch:b.workEpoch,jobHash:digest(String(stage.job_json)),sourceReleaseId:project.accepted_release_id as string|null};
  return {run,project,policy:p,basis,job,materials};
 }
 function current(r:Row){try{return canonical(freeze(json(r.request_json)).basis)===r.basis_json;}catch(error){if(error instanceof StorageError)return false;throw error;}}
 const view=(r:Row):ReleaseDelivery=>({operationId:String(r.operation_id),principalId:String(r.principal_id),projectId:String(r.project_id),runId:String(r.run_id),requestHash:String(r.request_hash),policyHash:String(r.policy_hash),basis:json(r.basis_json),state:r.state as ReleaseDelivery['state'],qualification:current(r)?'CURRENT':'STALE',image:r.image_json?json(r.image_json):null,dataPlan:r.data_plan_json?json(r.data_plan_json):null});
 const material=(t:Target)=>get('SELECT * FROM release_delivery_materials WHERE operation_id=? AND material_key=?',t.operationId,t.materialKey)??fail('DELIVERY_MATERIAL_NOT_FOUND',404);
 const materialView=(r:Row):ReleaseDeliveryMaterial=>({operationId:String(r.operation_id),materialKey:String(r.material_key),path:String(r.output_path),outputIndex:Number(r.output_index),expectedHash:String(r.expected_hash),byteSize:Number(r.byte_size),writeKey:String(r.write_key),contentHash:r.content_hash as string|null,writeId:r.write_id as string|null});
 function ready(r:Row){if(!r.content_hash||!get("SELECT 1 FROM content_objects WHERE content_hash=? AND state='READY' AND byte_size=?",r.content_hash!,r.byte_size!))fail('DELIVERY_MATERIAL_UNAVAILABLE');}
 function checkData(r:Row,data:DeliveryDataPlan,hash:string){
  const b=json<ReleaseDeliveryBasis>(r.basis_json);
  if(data.runId!==r.run_id||data.codeCommit!==b.targetCommit||data.requirementRevision!==b.requirementRevision||data.planRevision!==b.planRevision||data.templateVersion!==b.templateVersion||data.checkConfigHash!==b.checkConfigHash||data.sourceReleaseId!==b.sourceReleaseId)fail('DELIVERY_DATA_PLAN_CHANGED');
  if(data.migrationRef&&!get("SELECT 1 FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.artifact_id=? AND a.project_id=? AND a.run_id=? AND a.content_hash=? AND a.state='READY' AND c.state='READY'",data.migrationRef.artifactId,r.project_id!,r.run_id!,data.migrationRef.sha256))fail('DELIVERY_MIGRATION_MISSING');
  if(data.strategy==='REPLACE'){const decision=get("SELECT * FROM decisions WHERE decision_id=? AND run_id=? AND actor_id=? AND subject_kind='CHANGE'",data.replacementDecisionId,r.run_id!,r.principal_id!);if(!decision||decision.basis_hash!==hash||canonical(json(decision.choice_json))!==canonical({kind:'REPLACE_DATA',approved:true,dataPlanHash:hash}))fail('DELIVERY_DATA_REPLACEMENT_UNAPPROVED');}
 }
 const handlers={
  registerReleaseDeliveryPolicy(i:ReleaseDeliveryInput<'registerReleaseDeliveryPolicy'>){return transaction(db,()=>{member(i.principalId,i.projectId,true);if(!quality)fail('RELEASE_DELIVERY_QUALITY_REQUIRED');const q=get('SELECT policy_json FROM quality_policies WHERE project_id=? AND config_hash=?',i.projectId,i.policy.checkConfigHash);if(!q)fail('RELEASE_DELIVERY_POLICY_CHANGED');const value=json<{templateVersion:string;delivery?:unknown}>(q.policy_json),{schemaVersion:_version,templateVersion,checkConfigHash:_config,...profile}=i.policy;if(value.templateVersion!==templateVersion||!value.delivery||canonical(value.delivery)!==canonical(profile))fail('RELEASE_DELIVERY_POLICY_CHANGED');const body=canonical(i.policy),hash=digest(body),old=get('SELECT policy_json FROM release_delivery_policies WHERE project_id=? AND policy_hash=?',i.projectId,hash);if(old&&old.policy_json!==body)fail('DELIVERY_POLICY_IMMUTABLE');if(!old)exec('INSERT INTO release_delivery_policies VALUES(?,?,?,?,?,?)',i.projectId,hash,i.policy.checkConfigHash,body,i.principalId,new Date().toISOString());return {policyHash:hash,policy:i.policy};});},
  getReleaseDeliveryPolicy(i:ReleaseDeliveryInput<'getReleaseDeliveryPolicy'>){member(i.principalId,i.projectId);return {policyHash:i.policyHash,policy:policy(i.projectId,i.policyHash)};},
  beginReleaseDelivery(i:Begin){return transaction(db,()=>{const requestHash=digest(canonical(i)),old=get('SELECT * FROM release_deliveries WHERE operation_id=?',i.operationId);if(old){owned(i.principalId,i.operationId,true);if(old.request_hash!==requestHash)fail('RELEASE_DELIVERY_REQUEST_CHANGED');return view(old);}const f=freeze(i);exec("INSERT INTO release_deliveries VALUES(?,?,?,?,?,?,?,?,?,?,'PREPARED',NULL,NULL,?)",i.operationId,i.principalId,f.run.project_id!,i.runId,i.qualityOperationId,i.policyHash,requestHash,canonical(i),canonical(f.basis),canonical(f.job),new Date().toISOString());for(const m of f.materials)exec('INSERT INTO release_delivery_materials VALUES(?,?,?,?,?,?,?,NULL,NULL)',i.operationId,m.materialKey,m.path,m.outputIndex,m.expectedHash,m.byteSize,randomUUID());return view(record(i.operationId));});},
  getReleaseDelivery(i:ReleaseDeliveryInput<'getReleaseDelivery'>){return view(owned(i.principalId,i.operationId));},
  getReleaseDeliveryOrigin(i:ReleaseDeliveryInput<'getReleaseDeliveryOrigin'>){const r=bound(i);return {job:json<PipelineInput<'recordPipelineStage'>['job']>(r.job_json),policy:policy(String(r.project_id),String(r.policy_hash))};},
  listReleaseDeliveryMaterials(i:ReleaseDeliveryInput<'listReleaseDeliveryMaterials'>){owned(i.principalId,i.operationId);return all('SELECT * FROM release_delivery_materials WHERE operation_id=? ORDER BY output_index',i.operationId).map(materialView);},
  completeReleaseDelivery(i:ReleaseDeliveryInput<'completeReleaseDelivery'>){return transaction(db,()=>{
   const r=bound(i),image=canonical(i.image),data=canonical(i.dataPlan);if(r.state==='READY'){if(r.image_json!==image||r.data_plan_json!==data)fail('RELEASE_DELIVERY_IMMUTABLE');return view(r);}if(!current(r))fail('RELEASE_DELIVERY_BASIS_STALE');
   const rows=all('SELECT * FROM release_delivery_materials WHERE operation_id=? ORDER BY output_index',i.operationId);for(const m of rows)ready(m);
   const byKey=new Map(rows.map(m=>[m.material_key,m])),b=json<ReleaseDeliveryBasis>(r.basis_json),p=policy(String(r.project_id),String(r.policy_hash)),layerRows=rows.filter(m=>String(m.material_key).startsWith('image.layer.')).sort((a,b)=>Number(String(a.material_key).slice(12))-Number(String(b.material_key).slice(12)));
   if(i.image.imageDigest!=='sha256:'+byKey.get('image.manifest')!.expected_hash||i.image.configDigest!=='sha256:'+byKey.get('image.config')!.expected_hash||i.image.buildArtifactHash!==byKey.get('build')!.expected_hash||i.image.targetCommit!==b.targetCommit||i.image.architecture!==p.architecture||i.image.layers.length!==layerRows.length||i.image.layers.some((l,index)=>l.digest!=='sha256:'+layerRows[index]!.expected_hash||l.byteSize!==layerRows[index]!.byte_size))fail('RELEASE_DELIVERY_IMAGE_CHANGED');
   const dataHash=digest(data);if(dataHash!==byKey.get('data.plan')!.expected_hash)fail('DELIVERY_DATA_PLAN_CANONICAL_REQUIRED');checkData(r,i.dataPlan,dataHash);
   exec("UPDATE release_deliveries SET state='READY',image_json=?,data_plan_json=? WHERE operation_id=?",image,data,i.operationId);return view(record(i.operationId));
  });},
 };
 return {
  authorize(principalId:string,target:Target){owned(principalId,target.operationId,true);return material(target);},
  validateWrite(i:{meta:{principalId:string;scopeId:string;idempotencyKey:string};target:Target;expectedHash:string;expectedSize:number}){const r=this.authorize(i.meta.principalId,i.target);if(i.meta.scopeId!==i.target.operationId||i.meta.idempotencyKey!==r.write_key||i.expectedHash!==r.expected_hash||i.expectedSize!==r.byte_size)fail('DELIVERY_MATERIAL_WRITE_CHANGED');},
  commit(principalId:string,target:Target,hash:string,writeId:string){const r=this.authorize(principalId,target);if(hash!==r.expected_hash||r.content_hash&&r.write_id!==writeId)fail('DELIVERY_MATERIAL_WRITE_CHANGED');if(!r.content_hash)exec('UPDATE release_delivery_materials SET content_hash=?,write_id=? WHERE operation_id=? AND material_key=?',hash,writeId,target.operationId,target.materialKey);return {contentHash:hash};},
  resolve(principalId:string,target:Target){owned(principalId,target.operationId);const r=material(target);ready(r);return {content_hash:String(r.content_hash)};},
  completionFacts(principalId:string,operationId:string){const r=owned(principalId,operationId,true);if(r.state!=='READY'||!current(r))fail('RELEASE_DELIVERY_BASIS_STALE');const materials=all('SELECT * FROM release_delivery_materials WHERE operation_id=? ORDER BY output_index',operationId);for(const m of materials)ready(m);return {delivery:view(r),policy:policy(String(r.project_id),String(r.policy_hash)),materials:materials.map(materialView)};},
  execute(method:ReleaseDeliveryMethod,input:unknown):unknown{const parsed=parseContract(releaseDeliveryRequests[method],input);return (handlers[method] as (i:unknown)=>unknown)(parsed);},
 };
}
