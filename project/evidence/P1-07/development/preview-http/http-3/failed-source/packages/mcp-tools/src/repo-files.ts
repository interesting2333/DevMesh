import {constants} from 'node:fs';
import {lstat,open,realpath,mkdir,link,rename,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {z} from 'zod';
import {opaqueKey} from '@devmesh/contracts';
import {canonical,repoBinding,repoCommitArgs,repoFileReadArgs,repoWriteFileArgs,repoDeleteFileArgs,repoFileProof,managedSourcePath} from '@devmesh/storage-sqlite';
import type {RepoFileOperation} from '@devmesh/storage-sqlite';
import type {RepoGitOptions,RepoWorkspaceBinding,RepoWorkspaceAccess,RepoWorkspaceLease} from './repo-git.js';
import {ToolError} from './protocol.js';
import type {ToolDefinition} from './protocol.js';
type Input=Parameters<ToolDefinition['execute']>[0];
type Identity=z.output<typeof repoFileProof>['file'];
export interface RepoFileContext {options:RepoGitOptions;binding(ref:string,permit:Input['permit']):Promise<RepoWorkspaceBinding>;safeRoot(b:RepoWorkspaceBinding,signal:AbortSignal):Promise<string>;git(root:string,args:string[],signal:AbortSignal):Promise<{out:Buffer}>;acquire(b:RepoWorkspaceBinding,input:Pick<Input,'operationId'|'permit'|'signal'>,toolName:string,purpose:RepoWorkspaceAccess['purpose']):Promise<RepoWorkspaceLease>}
const hash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const missing=(e:unknown)=>(e as NodeJS.ErrnoException).code==='ENOENT';
function deny(code:string):never{throw new ToolError(code,'not-sent');}
async function identity(path:string,directory=false):Promise<Identity>{const stat=await lstat(path,{bigint:true});if(stat.isSymbolicLink()||(directory?!stat.isDirectory():!stat.isFile()))deny('MCP_FILE_PATH_DENIED');return {path,device:String(stat.dev),fileId:String(stat.ino)};}
const same=(a:Identity,b:Identity)=>a.device===b.device&&a.fileId===b.fileId;
async function read(path:string,links=1){
 let before;try{before=await lstat(path,{bigint:true});}catch(e){if(missing(e))return null;throw e;}
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==BigInt(links)||before.size>2n*1024n*1024n)deny('MCP_FILE_PATH_DENIED');
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{
  const first=await handle.stat({bigint:true});if(first.dev!==before.dev||first.ino!==before.ino||first.nlink!==before.nlink||first.size!==before.size)deny('MCP_FILE_CHANGED');
  const bytes=await handle.readFile(),after=await handle.stat({bigint:true});
  if(bytes.length!==Number(first.size)||after.size!==first.size||after.mtimeNs!==first.mtimeNs||after.ctimeNs!==first.ctimeNs)deny('MCP_FILE_CHANGED');
  return {bytes,sha256:hash(bytes),mode:(first.mode&0o111n)!==0n?'100755':'100644',identity:{path,device:String(first.dev),fileId:String(first.ino)}};
 }finally{await handle.close();}
}
async function writeNew(path:string,bytes:Buffer,mode=0o600){const handle=await open(path,'wx',mode);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}}
async function syncDirectory(path:string){if(process.platform==='win32')return;const h=await open(path,'r');try{await h.sync();}finally{await h.close();}}
export function repoFileTools(context:RepoFileContext):ToolDefinition[]{
 const {options,binding,git,acquire}=context;
 const safeRoot=async(b:RepoWorkspaceBinding,signal:AbortSignal)=>{const root=await context.safeRoot(b,signal);if(new TextDecoder().decode((await git(root,['rev-parse','HEAD'],signal)).out).trim()!==b.baseCommit)deny('MCP_GIT_BASE_CHANGED');return root;};
 const publicBinding=(b:RepoWorkspaceBinding)=>repoBinding.parse(Object.fromEntries(Object.entries(b).filter(([k])=>!['root','gitDirectory','commonDirectory','identity'].includes(k))));
 const locations=(root:string,b:RepoWorkspaceBinding,id:string)=>{const parent=dirname(root),sidecar=join(parent,'.devmesh-file-operations'),group=join(sidecar,hash(b.workspaceRef)),directory=join(group,id);return {parent,sidecar,group,directory,stage:join(directory,'stage'),receipt:join(directory,'receipt'),previous:join(directory,'previous'),tombstone:join(directory,'deleted')};};
 async function target(root:string,path:string,create=false){
  if(!managedSourcePath.safeParse(path).success)deny('MCP_FILE_PATH_DENIED');const dirs:string[]=[root];let at=root;
  for(const part of path.split('/').slice(0,-1)){at=join(at,part);if(create)try{await mkdir(at);}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}await identity(at,true);dirs.push(at);}
  return {path:join(root,path),dirs};
 }
 async function ownedRead(input:Input,b:RepoWorkspaceBinding){
  if(input.permit.ownerKind!=='workflowAttempt'||input.permit.runId!==b.runId||input.permit.attemptId!==b.attemptId||input.args.baseCommit!==b.baseCommit||!input.permit.resources.some(r=>r.kind==='workspace'&&r.resourceId===b.resourceId))deny('MCP_WORKSPACE_DENIED');
 }
 async function authorized(input:Input,toolName:string){const permit=await options.storage.request('refreshMcpPermit',{permit:input.permit,toolName,action:'write'});await options.storage.request('authorizeMcpAction',{permit,toolName,action:'write'});return permit;}
 const finish=async(operation:RepoFileOperation,state:'SUCCEEDED'|'FAILED',result:Record<string,unknown>)=>options.storage.request('finishRepoFileOperation',{operationId:operation.operationId,requestHash:operation.requestHash,state,result:z.record(z.string(),z.json()).parse(result)});
 const result=(operation:RepoFileOperation)=>({operationId:operation.operationId,state:operation.state,...operation.result});
 async function prove(operation:RepoFileOperation,b:RepoWorkspaceBinding,signal:AbortSignal){
  const proof=operation.proof;if(!proof)return false;const root=await safeRoot(b,signal),loc=locations(root,b,operation.operationId),a=operation.request.args,t=await target(root,a.path);
  for(const dir of proof.directories)if(!same(await identity(dir.path,true),dir))return false;
  if(proof.file.path!==t.path||proof.directories.some(d=>!d.path)||!proof.directories.some(d=>d.path===loc.directory))return false;
  if(operation.toolName==='repo.writeFile'){
   const receipt=await read(loc.receipt,2),current=await read(t.path,2);
   return !!receipt&&!!current&&same(receipt.identity,proof.file)&&same(current.identity,proof.file)&&receipt.sha256===proof.sha256&&current.sha256===proof.sha256&&current.bytes.length===proof.byteSize;
  }
  const tombstone=await read(loc.tombstone,2),receipt=await read(loc.receipt,2);let absent=false;try{await lstat(t.path);}catch(e){if(missing(e))absent=true;else throw e;}
  return absent&&!!receipt&&!!tombstone&&same(receipt.identity,proof.file)&&same(tombstone.identity,proof.file)&&receipt.sha256===proof.sha256&&tombstone.sha256===proof.sha256&&tombstone.bytes.length===proof.byteSize;
 }
 async function cleanup(operation:RepoFileOperation,b:RepoWorkspaceBinding,signal:AbortSignal){
  if(operation.cleanupConfirmed)return operation;
  {
   const root=await safeRoot(b,signal),loc=locations(root,b,operation.operationId),proof=operation.proof!;
   for(const dir of proof.directories)if(!same(await identity(dir.path,true),dir))throw new ToolError('MCP_FILE_PROOF_CHANGED','unknown');
   // Only unlink the exact private receipt; the user target is never rewritten during recovery.
   let receipt;try{receipt=await lstat(loc.receipt,{bigint:true});}catch(e){if(!missing(e))throw e;}
   const material=operation.toolName==='repo.writeFile'?proof.file.path:loc.tombstone;
   if(receipt){const current=await read(material,2),copy=await read(loc.receipt,2);if(!current||!copy||!same(current.identity,proof.file)||!same(copy.identity,proof.file)||current.sha256!==proof.sha256||copy.sha256!==proof.sha256)throw new ToolError('MCP_FILE_PROOF_CHANGED','unknown');await unlink(loc.receipt);await syncDirectory(loc.directory);}
   else {const current=await read(material);if(!current||!same(current.identity,proof.file)||current.sha256!==proof.sha256)throw new ToolError('MCP_FILE_PROOF_CHANGED','unknown');}
  }
  return options.storage.request('confirmRepoFileCleanup',{operationId:operation.operationId,requestHash:operation.requestHash});
 }
 async function reconcile(operation:RepoFileOperation,b:RepoWorkspaceBinding,input:Input){
  if(canonical(operation.request.binding)!==canonical(publicBinding(b)))throw new ToolError('MCP_FILE_BINDING_CHANGED','unknown');
  if(operation.state==='FAILED'||operation.cleanupConfirmed)return result(operation);
  const lease=await acquire(b,{...input,operationId:operation.operationId},'repo.fileByOperation','reconcile');
  try{
   if(operation.state!=='SUCCEEDED'){
    let proven=false;try{proven=await prove(operation,b,input.signal);}catch{ /* Missing or changed proof is unknown, never a reason to repeat the edit. */ }
    if(!proven)return {operationId:operation.operationId,state:'OUTCOME_UNKNOWN'};
    operation=await finish(operation,'SUCCEEDED',{path:operation.request.args.path,sha256:operation.toolName==='repo.writeFile'?operation.proof!.sha256:null,byteSize:operation.toolName==='repo.writeFile'?operation.proof!.byteSize:0});
   }
   return result(await cleanup(operation,b,input.signal));
  }finally{await lease.release();}
 }
 async function execute(toolName:'repo.writeFile'|'repo.deleteFile',input:Input){
  const args=toolName==='repo.writeFile'?repoWriteFileArgs.parse(input.args):repoDeleteFileArgs.parse(input.args),b=await binding(args.workspaceRef,input.permit);
  let operation=await options.storage.request('beginRepoFileOperation',{permit:input.permit,operationId:input.operationId,toolName,args,binding:publicBinding(b)});
  if(!operation.created)return reconcile(operation,b,input);
  // A failed fence hand-off has admitted no file action. Its own Runner operation
  // may need reconciliation, but this original edit is a durable known failure.
  let prepared=false;const lease=await acquire(b,input,toolName,'write').catch(async(error:unknown)=>{await finish(operation,'FAILED',{code:'MCP_FILE_FENCE_NOT_ACQUIRED'});throw error;});
  try{
   const root=await safeRoot(b,input.signal),t=await target(root,args.path,true),old=await read(t.path);
   if((old?.sha256??null)!==args.expectedSha256)deny('MCP_FILE_CAS_CONFLICT');
   const loc=locations(root,b,input.operationId);
   for(const dir of [loc.parent,loc.sidecar,loc.group]){if(dir!==loc.parent)try{await mkdir(dir);}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}await identity(dir,true);}
   // Existing operation material is never adopted or overwritten.
   await mkdir(loc.directory,{mode:0o700});
   const directoryPaths=[...new Set([...t.dirs,b.gitDirectory,b.commonDirectory,loc.parent,loc.sidecar,loc.group,loc.directory])],directories=await Promise.all(directoryPaths.map(async path=>identity(await realpath(path),true)));
   let file:Identity,sha256:string,byteSize:number;
   if(toolName==='repo.writeFile'){
    const bytes=Buffer.from((args as z.output<typeof repoWriteFileArgs>).text,'utf8');await writeNew(loc.stage,bytes,old?.mode==='100755'?0o755:0o644);if(old)await writeNew(loc.previous,old.bytes);
    await link(loc.stage,loc.receipt);file={...await identity(loc.stage),path:t.path};sha256=hash(bytes);byteSize=bytes.length;
   }else {if(!old)deny('MCP_FILE_CAS_CONFLICT');await link(t.path,loc.receipt);file=old.identity;sha256=old.sha256;byteSize=old.bytes.length;}
   await syncDirectory(loc.directory);
   const permit=await authorized(input,toolName);
   operation={...operation,...await options.storage.request('prepareRepoFileOperation',{permit,operationId:input.operationId,requestHash:operation.requestHash,proof:{directories,file,sha256,byteSize}})};prepared=true;
   await authorized(input,toolName);if(input.signal.aborted)throw new ToolError('MCP_FILE_ABORTED','unknown');
   await safeRoot(b,input.signal);for(const dir of directories)if(!same(await identity(dir.path,true),dir))throw new ToolError('MCP_FILE_PROOF_CHANGED','unknown');
   const current=await read(t.path,toolName==='repo.deleteFile'?2:1);if((current?.sha256??null)!==args.expectedSha256||old&&(!current||!same(current.identity,old.identity)))throw new ToolError('MCP_FILE_CHANGED','unknown');
   await rename(toolName==='repo.writeFile'?loc.stage:t.path,toolName==='repo.writeFile'?t.path:loc.tombstone);
   await syncDirectory(dirname(t.path));await syncDirectory(loc.directory);
   if(!await prove(operation,b,input.signal))throw new ToolError('MCP_FILE_EFFECT_UNPROVEN','unknown');
   operation={...operation,...await finish(operation,'SUCCEEDED',{path:args.path,sha256:toolName==='repo.writeFile'?sha256:null,byteSize:toolName==='repo.writeFile'?byteSize:0})};
   return result(await cleanup(operation,b,input.signal));
  }catch(e){if(!prepared&&e instanceof ToolError&&e.outcome==='not-sent')await finish(operation,'FAILED',{code:e.code});throw e;}
  finally{await lease.release();}
 }
 const workspaceArgs=z.strictObject({workspaceRef:opaqueKey,baseCommit:repoCommitArgs.shape.baseCommit});
 return [
  {name:'repo.workspaceRead',description:'Read an actual bounded UTF-8 workspace file and its current SHA',schema:repoFileReadArgs,action:'read',effectClass:'READ',async execute(input){const a=repoFileReadArgs.parse(input.args),b=await binding(a.workspaceRef,input.permit);await ownedRead(input,b);const lease=await acquire(b,input,'repo.workspaceRead','read');try{await options.storage.request('assertRepoWorkspaceSettled',{permit:input.permit,workspaceRef:b.workspaceRef});const root=await safeRoot(b,input.signal),file=await read((await target(root,a.path)).path);if(!file)deny('MCP_FILE_NOT_FOUND');let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(file.bytes);}catch{deny('MCP_BINARY_FILE_UNSUPPORTED');}if(a.offset>text.length)deny('MCP_FILE_OFFSET_INVALID');const end=Math.min(text.length,a.offset+a.length);return {path:a.path,sha256:file.sha256,byteSize:file.bytes.length,offset:a.offset,nextOffset:end<text.length?end:null,text:text.slice(a.offset,end)};}finally{await lease.release();}}},
  {name:'repo.snapshot',description:'Hash actual tracked and nonignored source bytes under a workspace fence',schema:workspaceArgs,action:'read',effectClass:'READ',async execute(input){const b=await binding(String(input.args.workspaceRef),input.permit);await ownedRead(input,b);const lease=await acquire(b,input,'repo.snapshot','read');try{await options.storage.request('assertRepoWorkspaceSettled',{permit:input.permit,workspaceRef:b.workspaceRef});const root=await safeRoot(b,input.signal),paths=[...new Set(new TextDecoder('utf-8',{fatal:true}).decode((await git(root,['ls-files','--cached','--others','--exclude-standard','-z','--'],input.signal)).out).split('\0').filter(Boolean))].sort();if(paths.length>2000||new Set(paths.map(p=>p.toLowerCase())).size!==paths.length)deny('MCP_FILE_SNAPSHOT_TOO_LARGE');const files=[];let byteSize=0;for(const path of paths){const file=await read((await target(root,path)).path);if(!file)continue;byteSize+=file.bytes.length;if(byteSize>8*1024*1024)deny('MCP_FILE_SNAPSHOT_TOO_LARGE');files.push({path,mode:file.mode,sha256:file.sha256,byteSize:file.bytes.length});}const manifest={schemaVersion:'devmesh.workspace-source.v1',workspaceRef:b.workspaceRef,baseCommit:b.baseCommit,files,byteSize};const serialized=canonical(manifest);if(Buffer.byteLength(serialized)>192*1024)deny('MCP_FILE_SNAPSHOT_TOO_LARGE');return {...manifest,sha256:hash(serialized)};}finally{await lease.release();}}},
  {name:'repo.writeFile',description:'Compare previous SHA or absence, then atomically write approved UTF-8 bytes with durable original proof',schema:repoWriteFileArgs,action:'write',effectClass:'IDEMPOTENT_WRITE',execute:input=>execute('repo.writeFile',input)},
  {name:'repo.deleteFile',description:'Compare the previous SHA then retain the exact original file outside the mounted source tree',schema:repoDeleteFileArgs,action:'write',effectClass:'IDEMPOTENT_WRITE',execute:input=>execute('repo.deleteFile',input)},
  {name:'repo.fileByOperation',description:'Query original file mutation evidence without repeating a write or delete',schema:z.strictObject({operationId:opaqueKey}),action:'read',effectClass:'READ',async execute(input){const operation=await options.storage.request('getRepoFileOperation',{permit:input.permit,operationId:String(input.args.operationId)});return reconcile(operation,await binding(operation.request.binding.workspaceRef,input.permit),input);}},
 ];
}
