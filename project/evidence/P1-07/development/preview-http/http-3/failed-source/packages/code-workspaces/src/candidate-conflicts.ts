import {createHash} from 'node:crypto';
import type {LocalContentStore} from '@devmesh/blob-store';
import {canonical,candidateMaterialKey,candidateReportEnvelope} from '@devmesh/storage-sqlite';
import type {CandidateMaterial,CandidateMaterialDescriptor,SqliteStorage} from '@devmesh/storage-sqlite';
import type {CandidateConflictContext,CandidateMerge} from './candidate-integrations.js';
import {WorkspaceError} from './git.js';

const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
function fail(code:string):never{throw new WorkspaceError(code,'unknown');}
const key=(c:CandidateConflictContext)=>({principalId:c.record.principalId,operationId:c.record.operationId,ordinal:c.step.ordinal});
const bound=(c:CandidateConflictContext)=>({...key(c),requestHash:c.record.requestHash});
function blob(bytes:Uint8Array,objectId:string){if(bytes.byteLength>2*1024*1024||createHash('sha1').update('blob '+bytes.byteLength+'\0').update(bytes).digest('hex')!==objectId)fail('CANDIDATE_CONFLICT_BLOB_CHANGED');return Buffer.from(bytes);}

/** Content publication retains the raw report and virtual stage-1 bytes before
 * preparing the step. No recovery path invokes merge-tree again. */
export class LocalCandidateConflicts {
 constructor(readonly storage:SqliteStorage,readonly content:LocalContentStore){}
 private async put(c:CandidateConflictContext,row:CandidateMaterial,bytes?:Uint8Array){
  const d=row.descriptor;if(d.kind!=='FILE'&&d.kind!=='REPORT')return;if(!row.writeKey)fail('CANDIDATE_MATERIAL_WRITE_UNKNOWN');
   const source=bytes??{[Symbol.asyncIterator](){return {async next():Promise<IteratorResult<Uint8Array>>{throw new WorkspaceError('CANDIDATE_REPORT_BYTES_UNKNOWN','unknown');}};}};
  await this.content.put({meta:{principalId:c.record.principalId,scopeId:c.record.operationId,idempotencyKey:row.writeKey},target:{kind:'candidateMaterial',operationId:c.record.operationId,ordinal:c.step.ordinal,materialKey:row.materialKey},expectedHash:d.sha256,expectedSize:d.byteSize,mimeType:d.kind==='REPORT'?'application/json':'application/octet-stream'},source);await this.content.provider.verify(d.sha256,d.byteSize);
 }
 async capture(c:CandidateConflictContext,merge:CandidateMerge){
  const virtualBaseBlobs=[];let total=0;for(const objectId of [...new Set(merge.stages.filter(stage=>stage.stage===1).map(stage=>stage.objectId))].sort()){
   const bytes=blob(await c.repository.readBlob(objectId,c.signal),objectId);total+=bytes.length;if(total>16*1024*1024)fail('CANDIDATE_REPORT_TOO_LARGE');virtualBaseBlobs.push({objectId,base64:bytes.toString('base64')});
  }
  const envelope={schemaVersion:'devmesh.candidate-report.v1' as const,merge,virtualBaseBlobs},bytes=Buffer.from(canonical(envelope));candidateReportEnvelope.parse(envelope);if(bytes.length>32*1024*1024)fail('CANDIDATE_REPORT_TOO_LARGE');
  const [row]=await this.storage.request('declareCandidateMaterials',{...bound(c),materials:[{kind:'REPORT',mergeSha256:hash(canonical(merge)),sha256:hash(bytes),byteSize:bytes.length}]});await this.put(c,row!,bytes);
 }
 private async saved(c:CandidateConflictContext){
  const row=await this.storage.request('getCandidateMaterial',{...key(c),materialKey:'report'});if(!row)return null;
  if(row.descriptor.kind!=='REPORT')fail('CANDIDATE_REPORT_CHANGED');await this.put(c,row);
  const text=await this.content.readText(c.record.principalId,{kind:'candidateMaterial',operationId:c.record.operationId,ordinal:c.step.ordinal,materialKey:'report'},32*1024*1024),envelope=candidateReportEnvelope.parse(JSON.parse(text)),merge=envelope.merge;
  if(canonical(envelope)!==text||hash(text)!==row.descriptor.sha256||hash(canonical(merge))!==row.descriptor.mergeSha256||merge.ours!==c.step.ours||merge.theirs!==c.step.theirs||merge.base!==(merge.bases.length===1?merge.bases[0]:null)||new Set(merge.bases).size!==merge.bases.length||c.step.preparation&&(c.step.preparation.reportSha256!==row.descriptor.mergeSha256||c.step.preparation.tree!==merge.tree||c.step.preparation.clean!==merge.clean))fail('CANDIDATE_REPORT_CHANGED');
  const expected=new Set(merge.stages.filter(stage=>stage.stage===1).map(stage=>stage.objectId)),virtual=new Map<string,Buffer>();let size=0;
  for(const item of envelope.virtualBaseBlobs){const bytes=blob(Buffer.from(item.base64,'base64'),item.objectId);if(bytes.toString('base64')!==item.base64||!expected.delete(item.objectId)||virtual.has(item.objectId))fail('CANDIDATE_VIRTUAL_BASE_CHANGED');size+=bytes.length;if(size>16*1024*1024)fail('CANDIDATE_REPORT_TOO_LARGE');virtual.set(item.objectId,bytes);}if(expected.size)fail('CANDIDATE_VIRTUAL_BASE_MISSING');return {merge,virtual};
 }
 async recoverReport(c:CandidateConflictContext):Promise<CandidateMerge|null>{return (await this.saved(c))?.merge??null;}
 async publish(c:CandidateConflictContext,merge:CandidateMerge){
  const saved=await this.saved(c);if(!saved||canonical(saved.merge)!==canonical(merge)||merge.clean||c.step.state!=='CONFLICT_PENDING')fail('CANDIDATE_CONFLICT_UNPROVEN');
  const paths=[...new Set([...merge.stages.map(stage=>stage.path),...merge.messages.flatMap(message=>message.paths)])].sort();if(!paths.length||paths.length>4000)fail('CANDIDATE_CONFLICT_PATHS_INVALID');
  const versions=[...merge.bases.map(commit=>({version:'base.'+commit,commit})),{version:'ours',commit:merge.ours},{version:'theirs',commit:merge.theirs}],descriptors:CandidateMaterialDescriptor[]=[];
  const bytesByObject=new Map(saved.virtual);
  const file=async(path:string,version:string,objectId:string,mode:'100644'|'100755')=>{let bytes=bytesByObject.get(objectId);if(!bytes){bytes=blob(await c.repository.readBlob(objectId,c.signal),objectId);bytesByObject.set(objectId,bytes);}descriptors.push({kind:'FILE',path,version,objectId,mode,sha256:hash(bytes),byteSize:bytes.length});};
  for(const {version,commit} of versions){const entries=new Map((await c.repository.treeEntries(commit,c.signal)).map(entry=>[entry.path,entry]));for(const path of paths){const entry=entries.get(path);if(!entry)descriptors.push({kind:'ABSENT',path,version});else if(entry.kind==='DIRECTORY')descriptors.push({kind:'DIRECTORY',path,version,objectId:entry.objectId});else await file(path,version,entry.objectId,entry.mode);}}
  for(const path of paths)for(const stage of [1,2,3] as const){const entry=merge.stages.find(item=>item.path===path&&item.stage===stage),version='stage.'+stage;if(entry)await file(path,version,entry.objectId,entry.mode);else descriptors.push({kind:'ABSENT',path,version});}
  if(descriptors.length+1>20000)fail('CANDIDATE_MATERIALS_TOO_LARGE');
  for(let start=0;start<descriptors.length;start+=100){c.signal.throwIfAborted();const rows=await this.storage.request('declareCandidateMaterials',{...bound(c),materials:descriptors.slice(start,start+100)});for(const row of rows){const d=row.descriptor;if(d.kind==='FILE')await this.put(c,row,bytesByObject.get(d.objectId)??fail('CANDIDATE_CONFLICT_BLOB_MISSING'));}}
  const rows:CandidateMaterial[]=[];let afterKey='';while(true){const page=await this.storage.request('listCandidateMaterials',{...key(c),afterKey,limit:100});if(!page.length)break;rows.push(...page);afterKey=page.at(-1)!.materialKey;}
  const manifestSha256=hash(canonical({schemaVersion:'devmesh.candidate-materials.v1',operationId:c.record.operationId,ordinal:c.step.ordinal,materials:rows.map(row=>({materialKey:row.materialKey,descriptor:row.descriptor}))}));
  // Reject an extra original row rather than silently including unrequested data.
  const expectedKeys=new Set(['report',...descriptors.map(candidateMaterialKey)]);if(rows.length!==expectedKeys.size||rows.some(row=>!expectedKeys.has(row.materialKey)))fail('CANDIDATE_CONFLICT_MANIFEST_CHANGED');
  await this.storage.request('sealCandidateConflictMaterials',{...bound(c),materialCount:rows.length,manifestSha256});
  await c.repository.validate(c.signal);const proof={repositoryIdentity:c.basis.repository.identity,reportSha256:hash(canonical(merge)),manifestSha256,materialCount:rows.length};
  try{await this.storage.request('acknowledgeCandidateConflict',{...bound(c),proof});}catch(error){const record=await this.storage.request('getCandidateIntegration',{principalId:c.record.principalId,operationId:c.record.operationId}).catch(()=>null);if(record?.state!=='CONFLICT'||canonical(record.conflictAcknowledgement)!==canonical(proof))throw error;}
  return this.storage.request('getCandidateIntegration',{principalId:c.record.principalId,operationId:c.record.operationId});
 }
 async reconcile(c:CandidateConflictContext){const saved=await this.saved(c);if(!saved)fail('CANDIDATE_REPORT_BYTES_UNKNOWN');return this.publish(c,saved.merge);}
}
