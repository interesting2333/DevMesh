import {lstat,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {assertSeparate,canonicalRoot} from '@devmesh/blob-store';
import {canonical} from '@devmesh/storage-sqlite';
import type {GitDirectoryIdentity,Request,SourceArchive,SqliteStorage} from '@devmesh/storage-sqlite';
import type {AllocationFence,AllocationFencer} from './allocation.js';
import {ControlledGit,WorkspaceError} from './git.js';
export interface LocalSourceArchiveOptions {
 mode:'local-development';storage:SqliteStorage;controlDataRoot:string;runnerDataRoot:string;backupRoot:string;fencer:AllocationFencer;
}
function deny(code:string):never{throw new WorkspaceError(code);}
async function identity(provider:ControlledGit):Promise<GitDirectoryIdentity>{
 await provider.validate();const {root,gitDirectory,commonDirectory}=provider.identity,[r,g]=await Promise.all([lstat(root,{bigint:true}),lstat(gitDirectory,{bigint:true})]);return {root,gitDirectory,commonDirectory,rootDevice:String(r.dev),rootFileId:String(r.ino),gitDevice:String(g.dev),gitFileId:String(g.ino)};
}
/** Source-object retention only. This ACK never authorizes workspace deletion. */
export class LocalSourceArchives {
 readonly controlDataRoot:string;readonly runnerDataRoot:string;
 constructor(readonly options:LocalSourceArchiveOptions){
  if(options.mode!=='local-development'||!options.fencer||typeof options.fencer.acquire!=='function')deny('SOURCE_ARCHIVE_BACKEND_NOT_CONFIGURED');
  this.controlDataRoot=canonicalRoot(options.controlDataRoot);this.runnerDataRoot=canonicalRoot(options.runnerDataRoot);assertSeparate([this.controlDataRoot,this.runnerDataRoot,canonicalRoot(options.backupRoot)]);
 }
 private async project(record:SourceArchive){
  const r=record.basis.repository;if(!r.identity||r.identity.root!==join(await realpath(this.controlDataRoot),'repositories',r.projectId,'repo.git'))deny('SOURCE_ARCHIVE_REPOSITORY_CHANGED');
  const provider=await ControlledGit.open(r.identity!.root,'bare');if(canonical(await identity(provider))!==canonical(r.identity))deny('SOURCE_ARCHIVE_REPOSITORY_CHANGED');return provider;
 }
 private async source(record:SourceArchive){
  const a=record.basis.allocation;if(!a.identity||a.identity.root!==join(await realpath(this.runnerDataRoot),'workspaces',a.attemptId,'repo'))deny('SOURCE_ARCHIVE_WORKSPACE_CHANGED');
  const provider=await ControlledGit.open(a.identity!.root,'checkout');if(canonical(await identity(provider))!==canonical(a.identity))deny('SOURCE_ARCHIVE_WORKSPACE_CHANGED');return provider;
 }
 private async acknowledge(record:SourceArchive,permit:Request<'getSourceArchive'>['permit'],project:ControlledGit,signal:AbortSignal){
  const m=record.manifest;if(!m)throw new WorkspaceError('SOURCE_ARCHIVE_UNPREPARED','unknown');
  const archiveRef='refs/devmesh/source-archives/'+record.operationId,sourceRef='refs/devmesh/sources/'+m.commit;
  if(await project.readRef(archiveRef,signal)!==m.commit||await project.readRef(sourceRef,signal)!==m.commit)throw new WorkspaceError('SOURCE_ARCHIVE_RETENTION_UNKNOWN','unknown');
  if(canonical(await project.manifest(m.commit,signal))!==canonical(m))throw new WorkspaceError('SOURCE_ARCHIVE_SOURCE_CHANGED','unknown');
  const acknowledgement={commit:m.commit,tree:m.tree,manifestSha256:m.sha256,repositoryIdentity:await identity(project),archiveRef,sourceRef};
  try{return await this.options.storage.request('completeSourceArchive',{permit,operationId:record.operationId,requestHash:record.requestHash,acknowledgement});}
  catch(error){const original=await this.options.storage.request('getSourceArchive',{permit,operationId:record.operationId}).catch(()=>null);if(original?.state==='ACKNOWLEDGED'&&canonical(original.acknowledgement)===canonical(acknowledgement))return original;throw error;}
 }
 async archive(input:Request<'beginSourceArchive'>,signal=new AbortController().signal):Promise<SourceArchive>{
  let record=await this.options.storage.request('beginSourceArchive',input);if(['ACKNOWLEDGED','FAILED'].includes(record.state))return record;
  let projectFence:AllocationFence|undefined,workspaceFence:AllocationFence|undefined,transferring=false;
  try{
   projectFence=await this.options.fencer.acquire({kind:'project',directoryRoot:this.controlDataRoot,resourceId:record.basis.repository.resourceId,operationId:record.operationId},signal);
   workspaceFence=await this.options.fencer.acquire({kind:'workspace',directoryRoot:this.runnerDataRoot,resourceId:record.workspaceRef,operationId:record.operationId,permit:input.permit,purpose:'cleanup'},signal);
   await this.options.storage.request('assertRepoWorkspaceSettled',{permit:input.permit,workspaceRef:record.workspaceRef});
   const project=await this.project(record);if(!record.created)return await this.acknowledge(record,input.permit,project,signal);
   const source=await this.source(record),prepared=record.basis.commitOperation.prepared!,base=record.basis.allocation.baseCommit,info=await source.commit(prepared.commit,signal);
   if(info.body!==prepared.commitBody||info.body.length>10000||info.tree!==prepared.tree||info.parents.length!==1||info.parents[0]!==base||await source.readRef(prepared.ref,signal)!==prepared.commit)deny('SOURCE_ARCHIVE_COMMIT_CHANGED');
   const changed=await source.changedPaths(base,info.commit,signal),scope=record.basis.allocation.scope;
   if(changed.some(path=>!scope.some(s=>path===s||path.startsWith(s+'/'))))deny('SOURCE_ARCHIVE_SCOPE_DENIED');
   const manifest=await source.manifest(info.commit,signal);
   record={...record,...await this.options.storage.request('prepareSourceArchive',{permit:input.permit,operationId:record.operationId,requestHash:record.requestHash,manifest})};
   transferring=true;await project.importCommit(await source.exportCommit(info.commit,signal),info.commit,signal);
   if(canonical(await project.manifest(info.commit,signal))!==canonical(manifest))throw new WorkspaceError('SOURCE_ARCHIVE_SOURCE_CHANGED','unknown');
   const archiveRef='refs/devmesh/source-archives/'+record.operationId,sourceRef='refs/devmesh/sources/'+info.commit,old=await project.readRef(sourceRef,signal);
   if(old!==null&&old!==info.commit)throw new WorkspaceError('SOURCE_ARCHIVE_REF_CHANGED','unknown');
   await project.updateRefs([{ref:archiveRef,commit:info.commit,expected:null},{ref:sourceRef,commit:info.commit,expected:old}],signal);
   return await this.acknowledge(record,input.permit,project,signal);
  }catch(error){
   const errorCode=error instanceof WorkspaceError?error.code:'SOURCE_ARCHIVE_OUTCOME_UNKNOWN';
   if(record.created&&record.state==='SENT'&&!transferring&&(!workspaceFence||error instanceof WorkspaceError&&error.outcome==='not-sent'))await this.options.storage.request('failSourceArchive',{permit:input.permit,operationId:record.operationId,requestHash:record.requestHash,errorCode}).catch(()=>{});
   else await this.options.storage.request('markSourceArchiveUncertain',{permit:input.permit,operationId:record.operationId,requestHash:record.requestHash,errorCode}).catch(()=>{});
   throw error;
  }finally{
   // If a workspace release is unknown, retain the project lock as well.
   if(workspaceFence)await workspaceFence.release();if(projectFence)await projectFence.release();
  }
 }
 async reconcile(input:Request<'getSourceArchive'>,signal=new AbortController().signal){
  const record=await this.options.storage.request('getSourceArchive',input);return this.archive({...input,allocationOperationId:record.allocationOperationId,commitOperationId:record.commitOperationId},signal);
 }
}
