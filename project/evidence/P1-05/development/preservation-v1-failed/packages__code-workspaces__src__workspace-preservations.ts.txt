import {createHash} from 'node:crypto';
import {lstat,mkdir,open,readFile,realpath} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {assertSeparate,canonicalRoot} from '@devmesh/blob-store';
import type {LocalContentStore} from '@devmesh/blob-store';
import {canonical,workspacePreservationMaterialKey} from '@devmesh/storage-sqlite';
import type {GitDirectoryIdentity,Request,SqliteStorage,WorkspacePreservation,WorkspacePreservationInputs} from '@devmesh/storage-sqlite';
import type {AllocationFence,AllocationFencer} from './allocation.js';
import {ControlledGit,WorkspaceError} from './git.js';
import {LocalSourceArchives} from './source-archives.js';
import {captureWorkspaceMaterials,verifyWorkspaceMaterials} from './workspace-materials.js';
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
function fail(code:string):never{throw new WorkspaceError(code,'unknown');}
async function exists(path:string){try{await lstat(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
async function identity(provider:ControlledGit):Promise<GitDirectoryIdentity>{await provider.validate();const {root,gitDirectory,commonDirectory}=provider.identity,[r,g]=await Promise.all([lstat(root,{bigint:true}),lstat(gitDirectory,{bigint:true})]);return {root,gitDirectory,commonDirectory,rootDevice:String(r.dev),rootFileId:String(r.ino),gitDevice:String(g.dev),gitFileId:String(g.ino)};}
async function syncDirectory(path:string){if(process.platform==='win32')return;const file=await open(path,'r');try{await file.sync();}finally{await file.close();}}
function baseFiles(b:WorkspacePreservationInputs){return [...new Set([b.allocation.manifest!,...b.commits.map(c=>c.archive!.manifest)].flatMap(m=>m.files.map(f=>f.path)))].sort();}
export interface LocalWorkspacePreservationOptions {
 mode:'local-development';storage:SqliteStorage;content:LocalContentStore;controlDataRoot:string;runnerDataRoot:string;backupRoot:string;fencer:AllocationFencer;sourceArchives:LocalSourceArchives;
}
export interface PreservedWorkspaceLease {record:WorkspacePreservation;parent:string;release():Promise<void>}

/** Full original-material preservation. A durable control ACK and a separately
 * fsynced Runner-local receipt are required before the reclamation boundary.
 * This service never deletes a workspace or infers a stopped job from expiry. */
export class LocalWorkspacePreservations {
 readonly controlDataRoot:string;readonly runnerDataRoot:string;
 constructor(readonly options:LocalWorkspacePreservationOptions){
  if(options.mode!=='local-development'||!options.fencer||typeof options.fencer.acquire!=='function'||!options.sourceArchives)fail('WORKSPACE_PRESERVATION_BACKEND_NOT_CONFIGURED');
  this.controlDataRoot=canonicalRoot(options.controlDataRoot);this.runnerDataRoot=canonicalRoot(options.runnerDataRoot);assertSeparate([this.controlDataRoot,this.runnerDataRoot,canonicalRoot(options.backupRoot)]);
  if(options.content.storage!==options.storage||canonicalRoot(options.content.dataRoot)!==this.controlDataRoot||options.sourceArchives.options.storage!==options.storage||options.sourceArchives.controlDataRoot!==this.controlDataRoot||options.sourceArchives.runnerDataRoot!==this.runnerDataRoot||options.sourceArchives.options.fencer!==options.fencer)fail('WORKSPACE_PRESERVATION_STORAGE_CHANGED');
 }
 private async acquire(record:WorkspacePreservation,permit:Request<'getWorkspacePreservation'>['permit'],signal:AbortSignal){
  let project:AllocationFence|undefined,workspace:AllocationFence|undefined;
  try{project=await this.options.fencer.acquire({kind:'project',directoryRoot:this.controlDataRoot,resourceId:record.basis.repository.resourceId,operationId:record.operationId},signal);workspace=await this.options.fencer.acquire({kind:'workspace',directoryRoot:this.runnerDataRoot,resourceId:record.workspaceRef,operationId:record.operationId,permit,purpose:'cleanup'},signal);let released=false;return {release:async()=>{if(released)return;await workspace!.release();await project!.release();released=true;}};
  }catch(error){if(project)await project.release();throw error;}
 }
 private async directories(record:WorkspacePreservation,signal:AbortSignal){
  const b=record.basis,a=b.allocation,projectRoot=join(await realpath(this.controlDataRoot),'repositories',a.projectId,'repo.git'),parent=join(await realpath(this.runnerDataRoot),'workspaces',a.attemptId),workspaceRoot=join(parent,'repo');
  if(b.repository.identity?.root!==projectRoot||a.identity?.root!==workspaceRoot||await realpath(parent)!==parent)fail('WORKSPACE_PRESERVATION_DIRECTORY_CHANGED');canonicalRoot(parent);
  const before=await lstat(parent,{bigint:true}),markerPath=join(parent,'code-directory.json'),markerStat=await lstat(markerPath),expected=canonical({schemaVersion:'devmesh.code-directory.v1',section:'workspaces',id:a.attemptId,operationId:a.operationId,requestHash:a.requestHash,device:String(before.dev),fileId:String(before.ino)});
  if(!before.isDirectory()||before.isSymbolicLink()||!markerStat.isFile()||markerStat.isSymbolicLink()||markerStat.nlink!==1||markerStat.size>16384||await readFile(markerPath,'utf8')!==expected)fail('WORKSPACE_PRESERVATION_DIRECTORY_UNOWNED');
  const project=await ControlledGit.open(projectRoot,'bare'),workspace=await ControlledGit.open(workspaceRoot,'checkout');if(canonical(await identity(project))!==canonical(b.repository.identity)||canonical(await identity(workspace))!==canonical(a.identity)||await workspace.head(signal)!==a.baseCommit)fail('WORKSPACE_PRESERVATION_DIRECTORY_CHANGED');
  await workspace.verifyAttemptBranch(a.baseCommit,a.attemptId,signal);if(await workspace.readRef('refs/devmesh/allocations/'+a.operationId,signal)!==a.baseCommit)fail('WORKSPACE_PRESERVATION_BASE_CHANGED');
  await workspace.verifyPreservationBasis(a.baseCommit,[{ref:'refs/devmesh/allocations/'+a.operationId,commit:a.baseCommit},{ref:'refs/heads/devmesh/'+a.attemptId,commit:a.baseCommit},...b.commits.map(c=>({ref:c.ref,commit:c.commit}))],signal);
  return {parent,project,workspace,parentMarkerSha256:hash(expected)};
 }
 private async retained(record:WorkspacePreservation,project:ControlledGit,signal:AbortSignal){
  const m=record.manifest;if(!m)fail('WORKSPACE_PRESERVATION_UNPREPARED');for(const r of m.retained){if(await project.readRef(r.ref,signal)!==r.commit||canonical(await project.manifest(r.commit,signal))!==canonical(r.manifest))fail('WORKSPACE_PRESERVATION_RETENTION_UNKNOWN');}
  for(const c of record.basis.commits){const a=c.archive!.acknowledgement;if(await project.readRef(a.sourceRef,signal)!==c.commit||a.commit!==c.commit||a.tree!==c.tree||a.manifestSha256!==c.archive!.manifest.sha256||canonical(a.repositoryIdentity)!==canonical(record.basis.repository.identity))fail('WORKSPACE_PRESERVATION_RETENTION_UNKNOWN');}
 }
 private receiptPath(record:WorkspacePreservation){return join(this.runnerDataRoot,'registry','workspace-preservations',record.workspaceRef,record.operationId,'receipt.json');}
 private receiptBytes(record:WorkspacePreservation){if(record.state!=='ACKNOWLEDGED'||!record.acknowledgement)fail('WORKSPACE_PRESERVATION_ACK_REQUIRED');return canonical({schemaVersion:'devmesh.workspace-preservation-receipt.v1',operationId:record.operationId,allocationOperationId:record.allocationOperationId,workspaceRef:record.workspaceRef,requestHash:record.requestHash,acknowledgement:record.acknowledgement});}
 private async receipt(record:WorkspacePreservation,create:boolean){
  const path=this.receiptPath(record),expected=this.receiptBytes(record),directory=dirname(path);if(create){canonicalRoot(this.runnerDataRoot);await mkdir(directory,{recursive:true,mode:0o700});canonicalRoot(directory);if(!await exists(path)){const output=await open(path,'wx',0o600);try{await output.writeFile(expected);await output.sync();}finally{await output.close();}await syncDirectory(directory);}}
  canonicalRoot(directory);const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>32768||await readFile(path,'utf8')!==expected)fail('WORKSPACE_PRESERVATION_RECEIPT_CHANGED');
 }
 private async publish(record:WorkspacePreservation,permit:Request<'getWorkspacePreservation'>['permit'],bytes:ReadonlyMap<string,Buffer>){
  const m=record.manifest!;let afterKey='';while(true){const rows=await this.options.storage.request('listWorkspacePreservationMaterials',{permit,operationId:record.operationId,afterKey,limit:100});if(!rows.length)break;
   for(const row of rows){const path=m.snapshot.entries.find(e=>e.kind==='FILE'&&workspacePreservationMaterialKey(e.path)===row.materialKey)?.path,value=row.materialKey==='manifest'?Buffer.from(canonical(m)):path?bytes.get(path):undefined;if(!value||hash(value)!==row.sha256||value.length!==row.byteSize)fail('WORKSPACE_PRESERVATION_MATERIAL_CHANGED');
    await this.options.content.put({meta:{principalId:record.principalId,scopeId:record.operationId,idempotencyKey:row.writeKey},target:{kind:'workspacePreservation',operationId:record.operationId,materialKey:row.materialKey},expectedHash:row.sha256,expectedSize:row.byteSize,mimeType:row.materialKey==='manifest'?'application/json':'application/octet-stream'},value);await this.options.content.provider.verify(row.sha256,row.byteSize);
   }afterKey=rows.at(-1)!.materialKey;
  }
 }
 private async verifyContent(record:WorkspacePreservation,permit:Request<'getWorkspacePreservation'>['permit']){
  let afterKey='',count=0;while(true){const rows=await this.options.storage.request('listWorkspacePreservationMaterials',{permit,operationId:record.operationId,afterKey,limit:100});if(!rows.length)break;for(const row of rows){if(row.contentHash!==row.sha256||!row.writeId)fail('WORKSPACE_PRESERVATION_MATERIAL_UNAVAILABLE');await this.options.content.provider.verify(row.sha256,row.byteSize);count++;}afterKey=rows.at(-1)!.materialKey;}return count;
 }
 private settledRecovery(record:WorkspacePreservation){
  const prefix='.devmesh-file-operations/',group=hash(record.workspaceRef),operations=new Map(record.basis.fileOperations.map(op=>[op.operationId,op]));
  for(const entry of record.manifest!.snapshot.entries){if(!entry.path.startsWith(prefix))continue;const parts=entry.path.slice(prefix.length).split('/');if(parts[0]!==group||parts.length>3)fail('WORKSPACE_PRESERVATION_RECOVERY_UNKNOWN');if(parts.length===1){if(entry.kind!=='DIRECTORY')fail('WORKSPACE_PRESERVATION_RECOVERY_UNKNOWN');continue;}const op=operations.get(parts[1]!);if(!op||!op.cleanupConfirmed||!['SUCCEEDED','FAILED'].includes(op.state))fail('WORKSPACE_PRESERVATION_RECOVERY_UNKNOWN');if(parts.length===2){if(entry.kind!=='DIRECTORY')fail('WORKSPACE_PRESERVATION_RECOVERY_UNKNOWN');continue;}if(entry.kind!=='FILE'||!['stage','previous','receipt','deleted'].includes(parts[2]!)||op.state==='SUCCEEDED'&&['stage','receipt'].includes(parts[2]!))fail('WORKSPACE_PRESERVATION_RECOVERY_UNKNOWN');}
 }
 async archive(input:Request<'beginWorkspacePreservation'>,signal=new AbortController().signal):Promise<WorkspacePreservation>{
  // Object transfers acquire their own project/workspace fences first. Never
  // recurse into source retention while holding this non-reentrant barrier.
  let original:WorkspacePreservation|null;try{original=await this.options.storage.request('getWorkspacePreservation',{permit:input.permit,operationId:input.operationId});}catch(error){if((error as {code?:string}).code!=='WORKSPACE_PRESERVATION_NOT_FOUND')throw error;original=null;}
  if(!original){const inputs=await this.options.storage.request('getWorkspacePreservationInputs',{permit:input.permit,allocationOperationId:input.allocationOperationId});for(const c of inputs.commits)if(!c.archive){const operationId='op_'+hash('workspace-preservation-source\0'+input.allocationOperationId+'\0'+c.operationId);await this.options.sourceArchives.archive({permit:input.permit,operationId,allocationOperationId:input.allocationOperationId,commitOperationId:c.operationId},signal);}}
  const {created:_created,...pending}=await this.options.storage.request('beginWorkspacePreservation',input);let record:WorkspacePreservation=pending;
  if(record.state==='ACKNOWLEDGED'){await this.receipt(record,true);return record;}
  const fence=await this.acquire(record,input.permit,signal);try{
   const physical=await this.directories(record,signal),files=baseFiles(record.basis),mayRetain=record.state==='SENT';let capture;
   if(record.manifest)capture=await verifyWorkspaceMaterials(record.manifest.snapshot,files,signal);else{
    capture=await captureWorkspaceMaterials({root:physical.parent,baseFiles:files},signal);const manifest={schemaVersion:'devmesh.workspace-preservation.v1' as const,operationId:record.operationId,allocationOperationId:record.allocationOperationId,workspaceRef:record.workspaceRef,basisSha256:record.basisSha256,headCommit:record.basis.allocation.baseCommit,repositoryIdentity:record.basis.repository.identity!,workspaceIdentity:record.basis.allocation.identity!,parentMarkerSha256:physical.parentMarkerSha256,retained:[{ref:'refs/devmesh/workspace-preservations/'+record.operationId+'/base',commit:record.basis.allocation.baseCommit,manifest:record.basis.allocation.manifest!},...record.basis.commits.map(c=>({ref:c.archive!.acknowledgement.archiveRef,commit:c.commit,manifest:c.archive!.manifest}))],snapshot:capture.snapshot};
    record=await this.options.storage.request('prepareWorkspacePreservation',{permit:input.permit,operationId:record.operationId,requestHash:record.requestHash,manifest});
   }
   if(record.manifest!.parentMarkerSha256!==physical.parentMarkerSha256)fail('WORKSPACE_PRESERVATION_DIRECTORY_CHANGED');
   if(mayRetain){const base=record.manifest!.retained[0]!;if(await physical.project.readRef(base.ref,signal)!==null)fail('WORKSPACE_PRESERVATION_RETENTION_UNKNOWN');await physical.project.updateRefs([{ref:base.ref,commit:base.commit,expected:null}],signal);}
   // PREPARED recovery observes the original base ref. It never repeats Git
   // mutation, replaces an operation, or substitutes a current checkout.
   await this.retained(record,physical.project,signal);await this.publish(record,input.permit,capture.bytes);await verifyWorkspaceMaterials(record.manifest!.snapshot,files,signal);
   const acknowledgement={manifestSha256:hash(canonical(record.manifest)),snapshotSha256:record.manifest!.snapshot.sha256,materialCount:await this.verifyContent(record,input.permit),repositoryIdentity:await identity(physical.project),workspaceIdentity:await identity(physical.workspace),parentIdentity:record.manifest!.snapshot.identity};
   try{record=await this.options.storage.request('completeWorkspacePreservation',{permit:input.permit,operationId:record.operationId,requestHash:record.requestHash,acknowledgement});}catch(error){const observed=await this.options.storage.request('getWorkspacePreservation',{permit:input.permit,operationId:record.operationId}).catch(()=>null);if(observed?.state!=='ACKNOWLEDGED'||canonical(observed.acknowledgement)!==canonical(acknowledgement))throw error;record=observed;}
   await this.receipt(record,true);return record;
  }finally{await fence.release();}
 }
 async reconcile(input:Request<'getWorkspacePreservation'>,signal=new AbortController().signal){const original=await this.options.storage.request('getWorkspacePreservation',input);return this.archive({...input,allocationOperationId:original.allocationOperationId},signal);}
 /** Caller retains the actual Runner barrier until isolation is complete. */
 async acquireReclaimable(input:Request<'assertWorkspacePreservationReclaimable'>,signal=new AbortController().signal):Promise<PreservedWorkspaceLease>{
  const record=await this.options.storage.request('assertWorkspacePreservationReclaimable',input),fence=await this.acquire(record,input.permit,signal);try{
   const physical=await this.directories(record,signal);await this.receipt(record,false);this.settledRecovery(record);if(physical.parentMarkerSha256!==record.manifest!.parentMarkerSha256)fail('WORKSPACE_PRESERVATION_DIRECTORY_CHANGED');await this.retained(record,physical.project,signal);await verifyWorkspaceMaterials(record.manifest!.snapshot,baseFiles(record.basis),signal);if(await this.verifyContent(record,input.permit)!==record.acknowledgement!.materialCount)fail('WORKSPACE_PRESERVATION_ACK_UNPROVEN');await this.options.storage.request('assertWorkspacePreservationReclaimable',input);return {record,parent:physical.parent,release:fence.release};
  }catch(error){await fence.release();throw error;}
 }
}
