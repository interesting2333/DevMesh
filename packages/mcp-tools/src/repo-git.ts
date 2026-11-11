import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {devNull} from 'node:os';
import {lstat,mkdir,mkdtemp,realpath,rmdir,unlink} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {z} from 'zod';
import {canonicalRoot} from '@devmesh/blob-store';
import {opaqueKey,relativeFile} from '@devmesh/contracts';
import {canonical,repoBinding,repoCommitArgs,repoIntegrateArgs} from '@devmesh/storage-sqlite';
import type {RepoOperation,SqliteStorage} from '@devmesh/storage-sqlite';
import {ToolError} from './protocol.js';
import type {ToolDefinition} from './protocol.js';

const bindingSchema=repoBinding.extend({root:z.string().min(1),gitDirectory:z.string().min(1),commonDirectory:z.string().min(1)});
export type RepoWorkspaceBinding=z.output<typeof bindingSchema>;
export interface RepoWorkspaceLease {release():Promise<void>}
/** The allocator must fence Runner/editors as well as other Git writers. */
export interface RepoGitOptions {storage:SqliteStorage;bindings:readonly RepoWorkspaceBinding[];scratchRoot:string;acquire:(binding:RepoWorkspaceBinding,signal:AbortSignal)=>Promise<RepoWorkspaceLease>;authorizeIntegration?:(binding:RepoWorkspaceBinding,commit:string,signal:AbortSignal)=>Promise<void>}
const denied=(path:string)=>path.split('/').some(v=>v.startsWith('.')||['node_modules','vendor','secrets'].includes(v.toLowerCase())||v.includes(':')||Array.from(v).some(c=>c.charCodeAt(0)<32)||/\.(pem|key|p12|pfx)$/i.test(v));
const within=(root:string,path:string)=>{const rel=relative(root,path);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+(process.platform==='win32'?'\\':'/'));};
const oid=(v:string)=>{if(!/^[a-f0-9]{40}$/.test(v))throw new ToolError('MCP_GIT_OBJECT_INVALID');return v;};
const text=(b:Buffer)=>new TextDecoder('utf-8',{fatal:true}).decode(b);
const locks=new Set<string>();
const gitNull=process.platform==='win32'?'NUL':devNull;

export function repoGitTools(options:RepoGitOptions):ToolDefinition[]{
  const bindings=options.bindings.map(b=>bindingSchema.parse(structuredClone(b)));
  if(new Set(bindings.map(b=>b.workspaceRef)).size!==bindings.length||typeof options.acquire!=='function')throw new ToolError('MCP_GIT_CONFIGURATION_INVALID','not-sent');
  canonicalRoot(options.scratchRoot);for(const b of bindings){canonicalRoot(b.root);canonicalRoot(b.gitDirectory);canonicalRoot(b.commonDirectory);}
  // Windows may provide a legitimate short (8.3) spelling for the temp root.
  // Freeze physical identities once; later path replacement must still fail.
  const physicalBindings=new Map(bindings.map(b=>{const ready=Promise.all([realpath(b.root),realpath(b.gitDirectory),realpath(b.commonDirectory)]).then(async([root,gitDirectory,commonDirectory])=>({root,gitDirectory,commonDirectory,directories:await Promise.all([...new Set([root!,gitDirectory!,commonDirectory!])].map(async path=>{const stat=await lstat(path,{bigint:true});return {path,dev:stat.dev,ino:stat.ino};}))}));void ready.catch(()=>{});return [b.workspaceRef,ready] as const;}));
  const binding=(ref:string)=>bindings.find(b=>b.workspaceRef===ref)??(()=>{throw new ToolError('MCP_WORKSPACE_DENIED','not-sent');})();
  const publicBinding=(b:RepoWorkspaceBinding)=>repoBinding.parse(Object.fromEntries(Object.entries(b).filter(([k])=>!['root','gitDirectory','commonDirectory'].includes(k))));
  function git(root:string,args:string[],signal:AbortSignal,index?:string,input?:string,allowFailure=false):Promise<{code:number;out:Buffer}>{
    if(signal.aborted)throw new ToolError('MCP_GIT_ABORTED','not-sent');
    const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('GIT_')));
    Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:gitNull,GIT_ATTR_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_LITERAL_PATHSPECS:'1',LC_ALL:'C',...(index?{GIT_INDEX_FILE:index}:{})});
    return new Promise((resolve,reject)=>{
      const child=spawn('git',['--no-replace-objects','--literal-pathspecs','-c','core.hooksPath='+gitNull,'-c','core.fsmonitor=false','-c','core.attributesFile='+gitNull,'-c','commit.gpgSign=false','-c','core.pager=cat','-c','protocol.allow=never',...args],{cwd:root,env,windowsHide:true,stdio:['pipe','pipe','pipe'],signal});
      const chunks:Buffer[]=[];let bytes=0,failed=false,ioFailure=false;
      const timer=setTimeout(()=>{failed=true;child.kill();},30000);timer.unref();
      child.stdout.on('data',(b:Buffer)=>{bytes+=b.length;if(bytes>16*1024*1024){failed=true;child.kill();}else chunks.push(b);});
      child.stderr.resume();child.stdin.on('error',()=>{});child.stdin.end(input);
      child.on('error',()=>{ioFailure=true;});
      child.on('close',code=>{clearTimeout(timer);if(ioFailure)reject(new ToolError('MCP_GIT_IO_UNKNOWN','unknown'));else if(failed||code===null||code!==0&&!allowFailure)reject(new ToolError('MCP_GIT_ACTION_FAILED','unknown'));else resolve({code,out:Buffer.concat(chunks)});});
    });
  }
  async function safeRoot(b:RepoWorkspaceBinding,signal:AbortSignal){
    const frozen=await physicalBindings.get(b.workspaceRef)!,root=await realpath(b.root);if(root!==frozen.root)throw new ToolError('MCP_WORKSPACE_CHANGED','not-sent');
    for(const entry of frozen.directories){const stat=await lstat(entry.path,{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink()||stat.dev!==entry.dev||stat.ino!==entry.ino)throw new ToolError('MCP_WORKSPACE_CHANGED','not-sent');}
    const [location,filters]=await Promise.all([git(root,['rev-parse','--show-toplevel','--show-object-format','--absolute-git-dir','--git-common-dir'],signal),git(root,['config','--get-regexp','^filter\\.'],signal,undefined,undefined,true)]);
    const [top,format,actualGit,common]=text(location.out).trim().split('\n');
    if(!top||format!=='sha1'||!actualGit||!common||await realpath(top)!==root)throw new ToolError('MCP_GIT_CONFIGURATION_INVALID','not-sent');
    if(await realpath(actualGit)!==frozen.gitDirectory||await realpath(resolve(root,common))!==frozen.commonDirectory)throw new ToolError('MCP_GIT_REPOSITORY_CHANGED','not-sent');
    if(filters.code!==1)throw new ToolError('MCP_GIT_FILTER_DENIED','not-sent');
    return root;
  }
  function scoped(paths:string[],scope:string[]){
    if(paths.length>2000||new Set(paths.map(p=>p.toLowerCase())).size!==paths.length)throw new ToolError('MCP_GIT_WRITE_SCOPE_DENIED','not-sent');
    for(const p of paths){if(!relativeFile.safeParse(p).success||denied(p)||!scope.some(s=>p===s||p.startsWith(s+'/')))throw new ToolError('MCP_GIT_WRITE_SCOPE_DENIED','not-sent');}
  }
  async function physical(root:string,paths:string[]){let bytes=0;for(const path of paths){let current=root;const parts=path.split('/');for(const [i,part] of parts.entries()){
    current=join(current,part);let s;try{s=await lstat(current);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')break;throw e;}
    if(s.isSymbolicLink()||i<parts.length-1&&!s.isDirectory()||i===parts.length-1&&(!s.isFile()||s.nlink!==1||s.size>2*1024*1024))throw new ToolError('MCP_GIT_PATH_DENIED','not-sent');
    if(i===parts.length-1){bytes+=s.size;if(bytes>8*1024*1024)throw new ToolError('MCP_GIT_CHANGE_TOO_LARGE','not-sent');}
  }}}
  const paths=(b:Buffer)=>text(b).split('\0').filter(Boolean);
  async function cleanIndex(temp:string,index:string){for(const file of [index,index+'.lock'])try{await unlink(file);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}await rmdir(temp);}
  async function writeTree(root:string,operation:RepoOperation,signal:AbortSignal){
    const base=operation.request.binding.baseCommit;
    const [head,changeList,otherList]=await Promise.all([git(root,['rev-parse','HEAD'],signal),git(root,['diff','--no-ext-diff','--no-textconv','--no-renames','--name-only','-z',base,'--'],signal),git(root,['ls-files','--others','--exclude-standard','-z','--'],signal)]);
    if(text(head.out).trim()!==base)throw new ToolError('MCP_GIT_BASE_CHANGED','not-sent');
    const changed=paths(changeList.out),untracked=paths(otherList.out),all=[...new Set([...changed,...untracked])];
    scoped(all,operation.scope);if(!all.length)throw new ToolError('MCP_GIT_EMPTY_COMMIT','not-sent');await physical(root,all);
    await mkdir(options.scratchRoot,{recursive:true});const scratch=await realpath(options.scratchRoot);if(scratch===root||within(root,scratch))throw new ToolError('MCP_GIT_SCRATCH_DENIED','not-sent');
    const temp=await mkdtemp(join(scratch,'repo-')),index=join(temp,'index');
    try{
      await git(root,['read-tree',base],signal,index);await git(root,['add','-A','--',...all],signal,index);
      const [entries,changes]=await Promise.all([git(root,['ls-files','--stage','-z'],signal,index),git(root,['diff','--cached','--no-ext-diff','--no-textconv','--name-only','-z',base,'--'],signal,index)]);
      for(const row of paths(entries.out))if(!/^100(644|755) [a-f0-9]{40} 0\t/.test(row))throw new ToolError('MCP_GIT_SPECIAL_ENTRY_DENIED','not-sent');
      scoped(paths(changes.out),operation.scope);
      await physical(root,all);return oid(text((await git(root,['write-tree'],signal,index)).out).trim());
    }finally{await cleanIndex(temp,index);}
  }
  async function finish(operation:RepoOperation,state:'SUCCEEDED'|'CONFLICT'|'FAILED',result:Record<string,string>){return options.storage.request('finishRepoOperation',{operationId:operation.operationId,requestHash:operation.requestHash,state,result});}
  async function reconcile(operation:RepoOperation,b:RepoWorkspaceBinding,signal:AbortSignal):Promise<unknown>{
    if(operation.result)return {operationId:operation.operationId,state:operation.state,...operation.result};
    const p=operation.prepared;if(!p)return {operationId:operation.operationId,state:'OUTCOME_UNKNOWN'};
    const root=await safeRoot(b,signal),ref=await git(root,['rev-parse','--verify',p.ref],signal,undefined,undefined,true);
    if(ref.code!==0||text(ref.out).trim()!==p.commit)return {operationId:operation.operationId,state:'OUTCOME_UNKNOWN'};
    const body=text((await git(root,['cat-file','commit',p.commit],signal)).out);
    if(p.commitBody!==null&&body!==p.commitBody||!body.startsWith('tree '+p.tree+'\n'))throw new ToolError('MCP_GIT_COMMIT_CHANGED','unknown');
    const result={commit:p.commit,tree:p.tree,baseCommit:operation.request.binding.baseCommit,ref:p.ref};await finish(operation,'SUCCEEDED',result);return {operationId:operation.operationId,state:'SUCCEEDED',...result};
  }
  async function execute(toolName:'repo.commit'|'repo.integrate',input:Parameters<ToolDefinition['execute']>[0]){
    const args=toolName==='repo.commit'?repoCommitArgs.parse(input.args):repoIntegrateArgs.parse(input.args),b=binding(args.workspaceRef);
    let operation=await options.storage.request('beginRepoOperation',{permit:input.permit,operationId:input.operationId,toolName,args,binding:publicBinding(b)});
    if(!operation.created)return reconcile(operation,b,input.signal);
    const key=toolName==='repo.integrate'?'project:'+b.projectId:resolve(b.root).toLowerCase();if(locks.has(key)){await finish(operation,'FAILED',{code:'MCP_GIT_WORKSPACE_BUSY'});throw new ToolError('MCP_GIT_WORKSPACE_BUSY','not-sent');}
    locks.add(key);let lease:RepoWorkspaceLease|undefined;
    try{
      lease=await options.acquire(structuredClone(b),input.signal);const root=await safeRoot(b,input.signal),base=args.baseCommit;
      if(toolName==='repo.commit'){
        const tree=await writeTree(root,operation,input.signal),message=(args as z.output<typeof repoCommitArgs>).message+'\n\nDevMesh-Operation: '+input.operationId+'\n',seconds=Math.floor(Date.parse(operation.createdAt)/1000);
        const identity='DevMesh <devmesh@localhost> '+seconds+' +0000',body=`tree ${tree}\nparent ${base}\nauthor ${identity}\ncommitter ${identity}\n\n${message}`;
        const commit=createHash('sha1').update(Buffer.from('commit '+Buffer.byteLength(body)+'\0')).update(body).digest('hex'),ref='refs/devmesh/operations/'+input.operationId;
        const current=await options.storage.request('refreshMcpPermit',{permit:input.permit,toolName,action:'write'});
        operation={...operation,...await options.storage.request('prepareRepoOperation',{permit:current,operationId:input.operationId,requestHash:operation.requestHash,prepared:{commit,tree,ref,expected:null,commitBody:body}})};
        await options.storage.request('authorizeMcpAction',{permit:current,toolName,action:'write'});
        const actual=oid(text((await git(root,['hash-object','-t','commit','-w','--stdin'],input.signal,undefined,body)).out).trim());if(actual!==commit)throw new ToolError('MCP_GIT_COMMIT_CHANGED','unknown');
        await git(root,['update-ref',ref,commit,'0'.repeat(40)],input.signal);
      }else{
        const commit=(args as z.output<typeof repoIntegrateArgs>).commit,source=await options.storage.request('getRepoOperation',{permit:input.permit,operationId:await sourceOperation(root,commit,input.signal)});
        if(source.toolName!=='repo.commit'||source.state!=='SUCCEEDED'||source.prepared?.commit!==commit||source.request.binding.workspaceRef!==b.workspaceRef)throw new ToolError('MCP_GIT_INTEGRATION_SOURCE_DENIED','not-sent');
        if(!options.authorizeIntegration)throw new ToolError('MCP_GIT_INTEGRATION_NOT_CONFIGURED','not-sent');await options.authorizeIntegration(structuredClone(b),commit,input.signal);
        const body=text((await git(root,['cat-file','commit',commit],input.signal)).out);if(!body.includes('\nparent '+base+'\n')||body.match(/\nparent /g)?.length!==1)throw new ToolError('MCP_GIT_INTEGRATION_SOURCE_DENIED','not-sent');
        scoped(paths((await git(root,['diff-tree','--no-commit-id','--name-only','-r','-z','--no-renames',base,commit,'--'],input.signal)).out),operation.scope);
        const tree=oid(text((await git(root,['rev-parse',commit+'^{tree}'],input.signal)).out).trim()),projectRef='refs/devmesh/candidates/'+b.runId,ref='refs/devmesh/integrations/'+input.operationId;
        const permit=await options.storage.request('refreshMcpPermit',{permit:input.permit,toolName,action:'write'});
        operation={...operation,...await options.storage.request('prepareRepoOperation',{permit,operationId:input.operationId,requestHash:operation.requestHash,prepared:{commit,tree,ref,expected:base,commitBody:null}})};
        await options.storage.request('authorizeMcpAction',{permit,toolName,action:'write'});
        const current=await git(root,['rev-parse','--verify',projectRef],input.signal,undefined,undefined,true);
        if(current.code!==0||text(current.out).trim()!==base){await finish(operation,'CONFLICT',{code:'MCP_GIT_INTEGRATION_CONFLICT'});return {operationId:operation.operationId,state:'CONFLICT',code:'MCP_GIT_INTEGRATION_CONFLICT'};}
        const updated=await git(root,['update-ref','--stdin'],input.signal,undefined,`start\nupdate ${projectRef} ${commit} ${base}\ncreate ${ref} ${commit}\nprepare\ncommit\n`,true);
        if(updated.code!==0){await finish(operation,'CONFLICT',{code:'MCP_GIT_INTEGRATION_CONFLICT'});return {operationId:operation.operationId,state:'CONFLICT',code:'MCP_GIT_INTEGRATION_CONFLICT'};}
      }
      const p=operation.prepared!,result={commit:p.commit,tree:p.tree,baseCommit:b.baseCommit,ref:p.ref};await finish(operation,'SUCCEEDED',result);
      return {operationId:operation.operationId,state:'SUCCEEDED',...result};
    }catch(error){if(error instanceof ToolError&&error.outcome==='not-sent'&&operation.state==='SENT')await finish(operation,'FAILED',{code:error.code});throw error;}
    finally{try{await lease?.release();}finally{locks.delete(key);}}
  }
  async function sourceOperation(root:string,commit:string,signal:AbortSignal){
    const refs=text((await git(root,['for-each-ref','--format=%(refname)','--points-at',commit,'refs/devmesh/operations/'],signal)).out).trim().split('\n').filter(Boolean);
    if(refs.length!==1)throw new ToolError('MCP_GIT_INTEGRATION_SOURCE_DENIED','not-sent');return opaqueKey.parse(refs[0]!.slice('refs/devmesh/operations/'.length));
  }
  const tools:ToolDefinition[]=[
    {name:'repo.diff',description:'Inspect bounded changes in an authorized fenced workspace against its frozen base',schema:z.strictObject({workspaceRef:opaqueKey,baseCommit:repoCommitArgs.shape.baseCommit}),action:'read',effectClass:'READ',async execute({args,permit,signal}){
      const b=binding(String(args.workspaceRef));if(permit.ownerKind!=='workflowAttempt'||permit.runId!==b.runId||permit.attemptId!==b.attemptId||args.baseCommit!==b.baseCommit||!permit.resources.some(r=>r.kind==='workspace'&&r.resourceId===b.resourceId))throw new ToolError('MCP_WORKSPACE_DENIED','not-sent');
      const lease=await options.acquire(structuredClone(b),signal);try{const root=await safeRoot(b,signal),changed=paths((await git(root,['diff','--no-ext-diff','--no-textconv','--no-renames','--name-only','-z',b.baseCommit,'--'],signal)).out),untracked=paths((await git(root,['ls-files','--others','--exclude-standard','-z','--'],signal)).out),all=[...new Set([...changed,...untracked])];if(all.length>2000||all.some(denied))throw new ToolError('MCP_GIT_PATH_DENIED','not-sent');await physical(root,all);const diff=(await git(root,['diff','--no-ext-diff','--no-textconv','--no-renames','--patch',b.baseCommit,'--'],signal)).out;if(diff.length>65536)throw new ToolError('MCP_GIT_DIFF_TOO_LARGE','not-sent');return {workspaceRef:b.workspaceRef,baseCommit:b.baseCommit,patch:text(diff),untracked};}finally{await lease.release();}
    }},
    {name:'repo.commit',description:'Commit only approved files from a fenced workspace at the frozen base',schema:repoCommitArgs,action:'write',effectClass:'IDEMPOTENT_WRITE',execute:input=>execute('repo.commit',input)},
    {name:'repo.integrate',description:'Integrate a proven commit into the Run candidate ref with a serialized base compare-and-swap',schema:repoIntegrateArgs,action:'write',effectClass:'IDEMPOTENT_WRITE',execute:input=>execute('repo.integrate',input)},
    {name:'repo.by-operation',description:'Reconcile the original Git operation without repeating its writes',schema:z.strictObject({operationId:opaqueKey}),action:'read',effectClass:'READ',async execute({args,permit,signal}){
      const operation=await options.storage.request('getRepoOperation',{permit,operationId:String(args.operationId)}),b=binding(operation.request.binding.workspaceRef);
      if(canonical(publicBinding(b))!==canonical(operation.request.binding))throw new ToolError('MCP_GIT_BINDING_CHANGED','unknown');return reconcile(operation,b,signal);
    }},
  ];return tools.filter(t=>t.name!=='repo.integrate'||options.authorizeIntegration!==undefined);
}
