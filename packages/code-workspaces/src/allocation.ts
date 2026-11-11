import {createHash} from 'node:crypto';
import {lstat,mkdir,open,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {opaqueKey} from '@devmesh/contracts';
import {assertSeparate,canonicalRoot} from '@devmesh/blob-store';
import {canonical} from '@devmesh/storage-sqlite';
import type {SqliteStorage,GitDirectoryIdentity,ManagedRepository,WorkspaceAllocation,Request} from '@devmesh/storage-sqlite';
import {ControlledGit,WorkspaceError} from './git.js';

export interface AllocationFence {release():Promise<void>}
export interface AllocationFencer {
  /** Must fence actual Runner writers; a timed control DB lock is insufficient. */
  acquire(input:{kind:'project'|'workspace';directoryRoot:string;resourceId:string;operationId:string;permit?:Request<'beginWorkspaceAllocation'>['permit'];purpose?:'write'|'cleanup'},signal:AbortSignal):Promise<AllocationFence>;
}
export interface LocalWorkspaceOptions {
  mode:'local-development';storage:SqliteStorage;controlDataRoot:string;runnerDataRoot:string;backupRoot:string;
  runnerId:string;templates:ReadonlyMap<string,ControlledGit>;fencer:AllocationFencer;
}
const fail=(code:string):never=>{throw new WorkspaceError(code);};
async function exists(path:string){try{await lstat(path);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}}
async function facts(provider:ControlledGit):Promise<GitDirectoryIdentity>{
  await provider.validate();const {root,gitDirectory,commonDirectory}=provider.identity,[r,g]=await Promise.all([lstat(root,{bigint:true}),lstat(gitDirectory,{bigint:true})]);
  return {root,gitDirectory,commonDirectory,rootDevice:String(r.dev),rootFileId:String(r.ino),gitDevice:String(g.dev),gitFileId:String(g.ino)};
}

/** Explicit local transport, with mandatory external fencing; never a CLI fallback. */
export class LocalManagedWorkspaces {
  readonly controlDataRoot:string;readonly runnerDataRoot:string;readonly #templates:ReadonlyMap<string,ControlledGit>;
  constructor(readonly options:LocalWorkspaceOptions){
    if(options.mode!=='local-development'||!options.fencer||typeof options.fencer.acquire!=='function')fail('WORKSPACE_BACKEND_NOT_CONFIGURED');
    this.controlDataRoot=canonicalRoot(options.controlDataRoot);this.runnerDataRoot=canonicalRoot(options.runnerDataRoot);const backup=canonicalRoot(options.backupRoot);assertSeparate([this.controlDataRoot,this.runnerDataRoot,backup]);opaqueKey.parse(options.runnerId);this.#templates=new Map(options.templates);
  }
  private async parent(root:string,section:'repositories'|'workspaces',id:string,basis:{operationId:string;requestHash:string},allowCreate:boolean){
    opaqueKey.parse(id);const top=join(root,section);if(!await exists(top)){if(!allowCreate)fail('WORKSPACE_DIRECTORY_MISSING');try{await mkdir(top,{recursive:false});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}}canonicalRoot(top);
    const parent=join(top,id);let created=false;if(!await exists(parent)){if(!allowCreate)fail('WORKSPACE_DIRECTORY_MISSING');try{await mkdir(parent,{recursive:false});created=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}}canonicalRoot(parent);
    const stat=await lstat(parent,{bigint:true}),expected=canonical({schemaVersion:'devmesh.code-directory.v1',section,id,operationId:basis.operationId,requestHash:basis.requestHash,device:String(stat.dev),fileId:String(stat.ino)}),marker=join(parent,'code-directory.json');
    if(created){const handle=await open(marker,'wx',0o600);try{await handle.writeFile(expected);await handle.sync();}finally{await handle.close();}}
    if(!await exists(marker))fail('WORKSPACE_DIRECTORY_UNOWNED');const m=await lstat(marker);if(!m.isFile()||m.isSymbolicLink()||m.nlink!==1||m.size>16384||await readFile(marker,'utf8')!==expected)fail('WORKSPACE_DIRECTORY_UNOWNED');return parent;
  }
  private async retained(destination:ControlledGit,source:ControlledGit,commit:string,operationId:string,signal:AbortSignal){
    const reference='refs/devmesh/allocations/'+opaqueKey.parse(operationId),original=await destination.readRef(reference,signal),expected=await source.manifest(commit,signal);
    if(original!==null&&original!==commit)fail('WORKSPACE_SOURCE_REF_CHANGED');
    if(original===null){await destination.importCommit(await source.exportCommit(commit,signal),commit,signal);if(!await destination.updateRefs([{ref:reference,commit,expected:null}],signal)&&await destination.readRef(reference,signal)!==commit)fail('WORKSPACE_SOURCE_REF_CHANGED');}
    const actual=await destination.manifest(commit,signal);if(actual.sha256!==expected.sha256)fail('WORKSPACE_SOURCE_CHANGED');return actual;
  }
  async ensureRepository(input:Request<'beginManagedRepository'>,signal=new AbortController().signal):Promise<{record:ManagedRepository;provider:ControlledGit}>{
    const pending=await this.options.storage.request('beginManagedRepository',input),source=this.#templates.get(pending.templateCommit);if(!source)fail('WORKSPACE_TEMPLATE_NOT_CONFIGURED');
    const fence=await this.options.fencer.acquire({kind:'project',directoryRoot:this.controlDataRoot,resourceId:pending.resourceId,operationId:pending.operationId},signal);
    try{
      const parent=await this.parent(this.controlDataRoot,'repositories',pending.projectId,pending,pending.state!=='READY'),path=join(parent,'repo.git');if(pending.state==='READY'&&!await exists(path))fail('WORKSPACE_DIRECTORY_MISSING');const provider=await exists(path)?await ControlledGit.open(path,'bare'):await ControlledGit.initialize(path,'bare');
      if(pending.state==='READY'){
        if(canonical(await facts(provider))!==canonical(pending.identity)||await provider.readRef('refs/devmesh/allocations/'+pending.operationId,signal)!==pending.templateCommit||!pending.manifest||(await provider.manifest(pending.templateCommit,signal)).sha256!==pending.manifest.sha256)fail('WORKSPACE_REPOSITORY_CHANGED');return {record:pending,provider};
      }
      const manifest=await this.retained(provider,source!,pending.templateCommit,pending.operationId,signal),record=await this.options.storage.request('completeManagedRepository',{operationId:pending.operationId,requestHash:pending.requestHash,identity:await facts(provider),manifest});return {record,provider};
    }finally{await fence.release();}
  }
  async allocate(input:Request<'beginWorkspaceAllocation'>,signal=new AbortController().signal):Promise<{record:WorkspaceAllocation;provider:ControlledGit}>{
    if(input.runnerId!==this.options.runnerId)fail('WORKSPACE_RUNNER_CHANGED');
    const pending=await this.options.storage.request('beginWorkspaceAllocation',input),fence=await this.options.fencer.acquire({kind:'workspace',directoryRoot:this.runnerDataRoot,resourceId:pending.workspaceRef,operationId:pending.operationId,permit:input.permit},signal);
    try{
      if(pending.state!=='READY')await this.options.storage.request('authorizeWorkspaceAllocation',{permit:input.permit,operationId:pending.operationId});
      const project=await this.options.storage.request('getAllocationRepository',{permit:input.permit,operationId:pending.operationId});if(project.state!=='READY'||!project.identity)fail('MANAGED_REPOSITORY_UNAVAILABLE');
      const source=await ControlledGit.open(project.identity!.root,'bare');if(canonical(await facts(source))!==canonical(project.identity))fail('WORKSPACE_REPOSITORY_CHANGED');
      const parent=await this.parent(this.runnerDataRoot,'workspaces',pending.attemptId,pending,pending.state!=='READY'),path=join(parent,'repo');if(pending.state==='READY'&&!await exists(path))fail('WORKSPACE_DIRECTORY_MISSING');const provider=await exists(path)?await ControlledGit.open(path,'checkout'):await ControlledGit.initialize(path,'checkout');
      if(pending.state==='READY'){
        await provider.verifyAttemptBranch(pending.baseCommit,pending.attemptId,signal);
        if(canonical(await facts(provider))!==canonical(pending.identity)||await provider.head(signal)!==pending.baseCommit||await provider.readRef('refs/devmesh/allocations/'+pending.operationId,signal)!==pending.baseCommit||!pending.manifest||(await provider.manifest(pending.baseCommit,signal)).sha256!==pending.manifest.sha256)fail('WORKSPACE_DIRECTORY_CHANGED');return {record:pending,provider};
      }
      const manifest=await this.retained(provider,source,pending.baseCommit,pending.operationId,signal);await this.options.storage.request('authorizeWorkspaceAllocation',{permit:input.permit,operationId:pending.operationId});await provider.checkoutAttempt(pending.baseCommit,pending.attemptId,signal);
      const record=await this.options.storage.request('completeWorkspaceAllocation',{operationId:pending.operationId,requestHash:pending.requestHash,identity:await facts(provider),manifest});return {record,provider};
    }catch(error){await this.options.storage.request('markWorkspaceAllocationUncertain',{operationId:pending.operationId,requestHash:pending.requestHash,errorCode:error instanceof WorkspaceError?error.code:'WORKSPACE_PREPARATION_UNKNOWN'}).catch(()=>{});throw error;}
    finally{await fence.release();}
  }
  static repositoryOperation(projectId:string,templateCommit:string){return 'op_'+createHash('sha256').update(projectId+'\0'+templateCommit).digest('hex');}
}
