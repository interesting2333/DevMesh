import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdir,writeFile,readFile,open,unlink,symlink,rename,link,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {repoGitTools,workflowToolAuthority,serveMcp,McpToolClient,runtimeMcpTools,ToolError} from '../packages/mcp-tools/dist/index.mjs';
import {httpFixture,prepareDispatch} from './fixtures/a2a-data.mjs';
import {meta} from './fixtures/storage-data.mjs';
import {ExecutionGrantLease} from '../packages/agent-runtime/dist/index.mjs';
import {openRunnerStorage,RunnerPolicy,RunnerManager,RunnerMaterials,RunnerClient,serveRunner} from '../packages/runner/dist/index.mjs';
import {LocalRunnerWorkspaceFencer,createLocalRepoAcquire} from '../packages/code-workspaces/dist/index.mjs';
import {ControlledBackend,image} from './fixtures/runner.mjs';
const op=()=> 'op_'+randomUUID().replaceAll('-','');
const exec=promisify(execFile);
const git=async(root,...args)=>(await exec('git',['-c','core.fsmonitor=false',...args],{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'}})).stdout.trim();
async function fixture(t,{managed=false,writeScope}={}){
  const cleanup=[];t.after(async()=>{const errors=[];for(const fn of cleanup.toReversed())try{await fn();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Git fixture cleanup failed');});
  const f=await httpFixture({after:fn=>cleanup.push(fn)}),scratchRoot=join(f.root,'git-scratch');let root=join(f.root,'git');await mkdir(root);await git(root,'init','--quiet');await git(root,'config','user.name','Fixture');await git(root,'config','user.email','fixture@localhost');await git(root,'config','core.autocrlf','false');
  await mkdir(join(root,'src'));await writeFile(join(root,'src/board.ts'),'export const count = 0;\n');await writeFile(join(root,'README.md'),'scope boundary\n');await git(root,'add','.');await git(root,'commit','--quiet','--no-gpg-sign','-m','Initial');const baseCommit=await git(root,'rev-parse','HEAD');
  const names=['repo.diff','repo.commit','repo.integrate','repo.by-operation','repo.workspaceRead','repo.writeFile','repo.deleteFile','repo.snapshot','repo.fileByOperation'];
  const p=await prepareDispatch(f,f.registry,{allowedTools:names.map(n=>n.replaceAll('.','_'))},{baseCommit,writeScope,resources:[{kind:'workspace',resourceId:'workspace_01',access:'write'},{kind:'projectRepository',resourceId:'repository_01',access:'write'}]});
  await f.storage.request('acceptA2AWork',p.request);const [claim]=await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'repo.fixture'});
  const sql=(query,...params)=>{const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));try{return db.prepare(query).all(...params);}finally{db.close();}};
  const permit=JSON.parse(sql('SELECT permit_json FROM execution_grants WHERE attempt_id=?',p.attemptId)[0].permit_json);
  const {endpointId,taskId,workerId,claimToken}=claim,lease=new ExecutionGrantLease(f.storage,{endpointId,taskId,workerId,claimToken},value=>Object.assign(permit,value));await lease.start();cleanup.push(()=>lease.stop());
  let runner;
  if(managed){
   const backupRoot=join(f.root,'backup-managed'),layout=await openRunnerStorage({dataRoot:join(f.root,'runner-managed'),controlDataRoot:f.local.dataRoot,backupRoot,runnerId:'runner.repo',initialize:true}),destination=join(layout.dataRoot,'workspaces',p.attemptId,'repo');await mkdir(join(layout.dataRoot,'workspaces',p.attemptId));await rename(root,destination);root=destination;
   const backend=new ControlledBackend(),policy=new RunnerPolicy({runnerId:'runner.repo',dataRoot:layout.dataRoot,imageDigests:[image],commands:{build:['node','scripts/build.mjs']},maximumCpu:4,maximumMemoryMiB:1024,maximumTemporaryMiB:64,workspaces:{}}),authority={
    async verify(controller,request,current){assert.equal(controller,'repo.controller');await f.storage.request('refreshMcpPermit',{permit:current,toolName:'repo.writeFile',action:'write'});assert.equal(request.workspaceRef,'workspace_01');},
    async verifyWorkspace(controller,current,workspaceRef){await this.verify(controller,{workspaceRef},current);},
    async verifyWorkspaceCleanup(controller,current,workspaceRef,operationId){assert.equal(controller,'repo.controller');const original=await f.storage.request('getRepoFileOperation',{permit:current,operationId});assert.equal(original.request.binding.resourceId,workspaceRef);},
   },manager=new RunnerManager(layout.store,policy,backend,authority,new RunnerMaterials(layout.dataRoot),{pollIntervalMs:600000});await manager.start();
   const credentials=async()=> 'runner-repo-fixture-service-secret',http=await serveRunner(manager,{identities:[{controllerId:'repo.controller',credentialRef:'runner.repo'}],credentials}),client=new RunnerClient('http://127.0.0.1:'+http.address.port,'runner.repo',credentials),fencer=new LocalRunnerWorkspaceFencer({mode:'local-development',runner:client,controlDataRoot:f.local.dataRoot,runnerDataRoot:layout.dataRoot,backupRoot});
   cleanup.push(async()=>{await http.close();await manager.close();await layout.close();});runner={client,backend,manager,layout,acquire:createLocalRepoAcquire(fencer)};
  }
  const binding={workspaceRef:'workspace_01',resourceId:'workspace_01',projectResourceId:'repository_01',projectId:p.projectId,runId:p.runId,attemptId:p.attemptId,baseCommit,root,gitDirectory:join(root,'.git'),commonDirectory:join(root,'.git')};await git(root,'update-ref','refs/devmesh/candidates/'+p.runId,baseCommit);
  let leases=0;
  const acquire=runner?.acquire??(async()=>{const path=join(f.root,'git-exclusive.lock'),handle=await open(path,'wx');leases++;return {async release(){await handle.close();await unlink(path);leases--;}};});
  async function service(storage,wrap=x=>x){
    // This fixture authorizes the low-level Git transaction only; product quality acceptance is separate.
    const tools=repoGitTools({storage,bindings:[binding],scratchRoot,acquire,authorizeIntegration:async(_b,commit)=>{assert.equal(await git(root,'cat-file','-t',commit),'commit');}}),server=await serveMcp({serviceId:'repo.local',version:'1.0.0',identities:[{controllerId:'repo.controller',credentialRef:'repo.local',allowedTools:names}],credentials:async()=> 'repo-local-service-secret',authority:workflowToolAuthority(storage,new Map([['repo.controller',new Set(names)]])),tools:tools.map(wrap)});
    const client=new McpToolClient({endpointId:'repo.local',endpoint:server.endpoint,credentialRef:'repo.local',timeoutMs:120000,credentials:async()=> 'repo-local-service-secret'});await client.connect();let closed=false;const close=async()=>{if(closed)return;closed=true;await client.close();await server.close();};cleanup.push(close);
    return {tools,client,close,call:(name,id,args)=>client.call(name,id,permit,args)};
  }
  const args={workspaceRef:binding.workspaceRef,baseCommit,message:'Implement board count'};
  return {...f,p,permit,binding,root,baseCommit,args,sql,service,runner,leases:()=>leases,...await service(f.storage)};
}

test('real Git commit and project integration retain scope, base, original identity and atomic refs',async t=>{
  const f=await fixture(t);await writeFile(join(f.root,'src/board.ts'),'export const count = 1;\n');
  const diff=await f.call('repo.diff',op(),{workspaceRef:'workspace_01',baseCommit:f.baseCommit});assert.match(diff.patch,/count = 1/);
  const id=op(),commit=await f.call('repo.commit',id,f.args);assert.equal(commit.state,'SUCCEEDED');assert.notEqual(commit.commit,f.baseCommit);assert.equal(await git(f.root,'rev-parse','HEAD'),f.baseCommit);
  assert.match(await git(f.root,'show',commit.commit+':src/board.ts'),/count = 1/);assert.deepEqual(await f.call('repo.commit',id,f.args),commit);
  await assert.rejects(f.call('repo.commit',id,{...f.args,message:'Different'}),{code:'IDEMPOTENCY_KEY_REUSED'});
  const integrated=await f.call('repo.integrate',op(),{workspaceRef:'workspace_01',baseCommit:f.baseCommit,commit:commit.commit});assert.equal(integrated.state,'SUCCEEDED');assert.equal(await git(f.root,'rev-parse','refs/devmesh/candidates/'+f.p.runId),commit.commit);
  const conflict=await f.call('repo.integrate',op(),{workspaceRef:'workspace_01',baseCommit:f.baseCommit,commit:commit.commit});assert.equal(conflict.state,'CONFLICT');assert.equal(f.leases(),0);assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);
});

test('out of scope paths, an unexpected base, filters and symbolic links cannot become commits',async t=>{
  const f=await fixture(t);await writeFile(join(f.root,'README.md'),'outside\n');
  await assert.rejects(f.call('repo.commit',op(),f.args),{code:'MCP_GIT_WRITE_SCOPE_DENIED'});assert.equal(await git(f.root,'for-each-ref','--format=%(refname)','refs/devmesh/operations/'),'');await git(f.root,'checkout','--','README.md');
  await assert.rejects(f.call('repo.commit',op(),{...f.args,baseCommit:'a'.repeat(40)}),{code:'REPO_BINDING_DENIED'});
  await git(f.root,'config','filter.attack.clean','irrelevant-command');await assert.rejects(f.call('repo.commit',op(),f.args),{code:'MCP_GIT_FILTER_DENIED'});await git(f.root,'config','--remove-section','filter.attack');
  const bytes=await readFile(join(f.root,'src/board.ts'));await unlink(join(f.root,'src/board.ts'));try{await symlink(join(f.root,'README.md'),join(f.root,'src/board.ts'));await assert.rejects(f.call('repo.commit',op(),f.args),{code:'MCP_GIT_PATH_DENIED'});}catch(e){if(e.code!=='EPERM')throw e;t.diagnostic('Windows symlink privilege absent; symlink branch not exercised');}finally{try{await unlink(join(f.root,'src/board.ts'));}catch{}await writeFile(join(f.root,'src/board.ts'),bytes);}
  assert.equal(f.leases(),0);assert.equal(await git(f.root,'rev-parse','HEAD'),f.baseCommit);
});

test('lost commit acknowledgement recovers the original ref after pause and restart',async t=>{
  const f=await fixture(t);await f.close();let dropped=false;
  const service=await f.service(f.storage,tool=>tool.name!=='repo.commit'?tool:{...tool,async execute(i){await tool.execute(i);dropped=true;throw new ToolError('SIMULATED_REPLY_LOSS','unknown');}});
  await writeFile(join(f.root,'src/board.ts'),'export const count = 2;\n');const id=op(),bridge=runtimeMcpTools(service.client,service.tools.filter(t=>t.name==='repo.commit'))[0];
  assert.equal((await bridge.execute(id,f.args,{permit:f.permit},new AbortController().signal)).state,'OUTCOME_UNKNOWN');assert.equal(dropped,true);
  const recovered=await bridge.query(id,{permit:f.permit});assert.equal(recovered.state,'SUCCEEDED');const commit=recovered.value.result.commit;
  const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});
  await assert.rejects(service.call('repo.commit',op(),f.args),{code:'MCP_AUTHORITY_DENIED'});assert.equal((await service.call('repo.by-operation',op(),{operationId:id})).commit,commit);
  await service.close();await f.agents.stop();await f.local.close();const reopened=await f.reopen(),second=await f.service(reopened.storage);assert.equal((await second.call('repo.by-operation',op(),{operationId:id})).commit,commit);
  assert.equal(f.sql('SELECT count(*) n FROM repo_operations')[0].n,1);assert.equal((await git(f.root,'for-each-ref','--format=%(refname)','refs/devmesh/operations/')).split('\n').length,1);
});

test('a crash after ref update recovers from Git, while an unprepared original operation remains unknown',async t=>{
  const f=await fixture(t);await f.close();let block=true;
  const proxy={request(method,input){if(method==='finishRepoOperation'&&block)throw Error('Crash before SQLite result acknowledgement');return f.storage.request(method,input);}};
  const s=await f.service(proxy);await writeFile(join(f.root,'src/board.ts'),'export const count = 3;\n');const id=op();
  await assert.rejects(s.call('repo.commit',id,f.args),{outcome:'unknown'});assert.equal(f.sql('SELECT state FROM repo_operations WHERE operation_id=?',id)[0].state,'PREPARED');block=false;
  const recovered=await s.call('repo.by-operation',op(),{operationId:id});assert.equal(recovered.state,'SUCCEEDED');assert.equal(await git(f.root,'rev-parse',recovered.ref),recovered.commit);
  const pending=op(),binding=Object.fromEntries(Object.entries(f.binding).filter(([k])=>!['root','gitDirectory','commonDirectory'].includes(k)));
  await f.storage.request('beginRepoOperation',{permit:f.permit,operationId:pending,toolName:'repo.commit',args:f.args,binding});
  const bridge=runtimeMcpTools(s.client,s.tools.filter(t=>t.name==='repo.commit'))[0];assert.equal((await bridge.query(pending,{permit:f.permit})).state,'OUTCOME_UNKNOWN');
  assert.equal((await git(f.root,'for-each-ref','--format=%(refname)','refs/devmesh/operations/')).split('\n').length,1);
});

test('integration recovery uses the atomic original-operation ref even after the project ref moves again',async t=>{
  const f=await fixture(t);await writeFile(join(f.root,'src/board.ts'),'export const count = 4;\n');const committed=await f.call('repo.commit',op(),f.args);await f.close();let block=true;
  const proxy={request(method,input){if(method==='finishRepoOperation'&&input.operationId===integration&&block)throw Error('Integration persisted only in Git');return f.storage.request(method,input);}};
  const integration=op(),s=await f.service(proxy);await assert.rejects(s.call('repo.integrate',integration,{workspaceRef:'workspace_01',baseCommit:f.baseCommit,commit:committed.commit}),{outcome:'unknown'});
  assert.equal(f.sql('SELECT state FROM repo_operations WHERE operation_id=?',integration)[0].state,'PREPARED');await git(f.root,'update-ref','refs/devmesh/candidates/'+f.p.runId,f.baseCommit,committed.commit);block=false;
  const recovered=await s.call('repo.by-operation',op(),{operationId:integration});assert.equal(recovered.state,'SUCCEEDED');assert.equal(recovered.commit,committed.commit);
  assert.equal(await git(f.root,'rev-parse','refs/devmesh/integrations/'+integration),committed.commit);assert.equal(await git(f.root,'rev-parse','refs/devmesh/candidates/'+f.p.runId),f.baseCommit);
});

test('a replacement repository at the same workspace path cannot inherit the frozen binding',async t=>{
  const f=await fixture(t);await f.call('repo.diff',op(),{workspaceRef:'workspace_01',baseCommit:f.baseCommit});
  const retained=f.root+'-original';await rename(f.root,retained);await mkdir(f.root);await git(f.root,'init','--quiet');
  await assert.rejects(f.call('repo.diff',op(),{workspaceRef:'workspace_01',baseCommit:f.baseCommit}),{code:'MCP_WORKSPACE_CHANGED'});
  assert.equal(await git(retained,'rev-parse','HEAD'),f.baseCommit);assert.equal(f.leases(),0);
});

const sha=text=>createHash('sha256').update(text).digest('hex');
test('MCP edits actual bytes with CAS, snapshots them, deletes by original identity and commits those changes',async t=>{
 const f=await fixture(t,{writeScope:['src']}),basis={workspaceRef:'workspace_01',baseCommit:f.baseCommit},path='src/board.ts';
 const before=await f.call('repo.workspaceRead',op(),{...basis,path});assert.equal(before.sha256,sha(before.text));
 const id=op(),args={...basis,path,expectedSha256:before.sha256,text:'export const count = 5;\n'},written=await f.call('repo.writeFile',id,args);
 assert.equal(written.state,'SUCCEEDED');assert.equal(written.sha256,sha(args.text));assert.equal(await readFile(join(f.root,path),'utf8'),args.text);assert.equal((await lstat(join(f.root,path))).nlink,1);
 assert.deepEqual(await f.call('repo.writeFile',id,args),written);
 const created={...basis,path:'src/new.ts',expectedSha256:null,text:'export const added = true;\n'};await f.call('repo.writeFile',op(),created);
 const snapshot=await f.call('repo.snapshot',op(),basis);assert.equal(snapshot.files.find(v=>v.path===created.path).sha256,sha(created.text));assert.equal(snapshot.files.find(v=>v.path===path).sha256,written.sha256);
 const deleted=await f.call('repo.deleteFile',op(),{...basis,path:created.path,expectedSha256:sha(created.text)});assert.equal(deleted.state,'SUCCEEDED');await assert.rejects(readFile(join(f.root,created.path)),{code:'ENOENT'});
 const diff=await f.call('repo.diff',op(),basis);assert.match(diff.patch,/count = 5/);
 const commit=await f.call('repo.commit',op(),f.args);assert.equal(commit.state,'SUCCEEDED');assert.match(await git(f.root,'show',commit.commit+':src/board.ts'),/count = 5/);
 assert.equal(f.sql('SELECT count(*) n FROM repo_file_operations WHERE cleanup_confirmed=1')[0].n,3);
});

test('file CAS, write scope, hard links and sensitive paths reject without overwriting source',async t=>{
 const f=await fixture(t),basis={workspaceRef:'workspace_01',baseCommit:f.baseCommit},path='src/board.ts',original=await readFile(join(f.root,path),'utf8');
 await assert.rejects(f.call('repo.writeFile',op(),{...basis,path,expectedSha256:'f'.repeat(64),text:'stale'}),{code:'MCP_FILE_CAS_CONFLICT'});
 await assert.rejects(f.call('repo.writeFile',op(),{...basis,path:'README.md',expectedSha256:null,text:'outside'}),{code:'REPO_FILE_SCOPE_DENIED'});
 await assert.rejects(f.call('repo.writeFile',op(),{...basis,path:'src/private.key',expectedSha256:null,text:'secret'}));
 const alias=join(f.root,'src/alias.ts');await link(join(f.root,path),alias);
 try{await assert.rejects(f.call('repo.writeFile',op(),{...basis,path,expectedSha256:sha(original),text:'linked'}),{code:'MCP_FILE_PATH_DENIED'});}finally{await unlink(alias);}
 assert.equal(await readFile(join(f.root,path),'utf8'),original);assert.equal(f.leases(),0);
});

test('a file rename with lost SQLite acknowledgement reconciles exact proof after restart and pause without rewriting',async t=>{
 const f=await fixture(t);await f.close();let blocked=true;
 const proxy={request(method,input){if(method==='finishRepoFileOperation'&&blocked)throw Error('Lost result after atomic rename');return f.storage.request(method,input);}},service=await f.service(proxy),basis={workspaceRef:'workspace_01',baseCommit:f.baseCommit},path='src/board.ts',text='export const count = 6;\n',id=op();
 const original=await readFile(join(f.root,path),'utf8');await assert.rejects(service.call('repo.writeFile',id,{...basis,path,expectedSha256:sha(original),text}),{outcome:'unknown'});
 assert.equal(f.sql('SELECT state FROM repo_file_operations WHERE operation_id=?',id)[0].state,'PREPARED');assert.equal(await readFile(join(f.root,path),'utf8'),text);
 await assert.rejects(service.call('repo.commit',op(),f.args),{code:'REPO_FILE_RECONCILIATION_REQUIRED'});
 const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});blocked=false;
 await service.close();await f.agents.stop();await f.local.close();const reopened=await f.reopen(),second=await f.service(reopened.storage),before=await lstat(join(f.root,path),{bigint:true});
 const recovered=await second.call('repo.fileByOperation',op(),{operationId:id});assert.equal(recovered.state,'SUCCEEDED');assert.equal(recovered.sha256,sha(text));const after=await lstat(join(f.root,path),{bigint:true});assert.equal(after.ino,before.ino);assert.equal(after.mtimeNs,before.mtimeNs);assert.equal(after.nlink,1n);
 assert.equal(f.sql('SELECT count(*) n FROM repo_file_operations')[0].n,1);
});

test('matching current bytes cannot prove an unprepared original edit and the unknown intent blocks further mutations',async t=>{
 const f=await fixture(t),id=op(),text='same bytes do not identify an operation\n',args={workspaceRef:'workspace_01',baseCommit:f.baseCommit,path:'src/board.ts',expectedSha256:null,text},binding=Object.fromEntries(Object.entries(f.binding).filter(([k])=>!['root','gitDirectory','commonDirectory'].includes(k)));
 await f.storage.request('beginRepoFileOperation',{permit:f.permit,operationId:id,toolName:'repo.writeFile',args,binding});await writeFile(join(f.root,args.path),text);
 assert.equal((await f.call('repo.fileByOperation',op(),{operationId:id})).state,'OUTCOME_UNKNOWN');
 await assert.rejects(f.call('repo.writeFile',op(),{...args,expectedSha256:sha(text),text:'overwrite'}),{code:'REPO_FILE_RECONCILIATION_REQUIRED'});await assert.rejects(f.call('repo.commit',op(),f.args),{code:'REPO_FILE_RECONCILIATION_REQUIRED'});assert.equal(await readFile(join(f.root,args.path),'utf8'),text);
});

test('MCP editing holds the actual Runner barrier, rejects queued jobs and reconciles a paused original edit with cleanup authority',async t=>{
 const f=await fixture(t,{managed:true}),basis={workspaceRef:'workspace_01',baseCommit:f.baseCommit},path='src/board.ts',before=await readFile(join(f.root,path),'utf8');await f.close();let block=false,observed=false;
 const proxy={async request(method,input){if(method==='prepareRepoFileOperation'){const fence=await f.runner.client.activeWorkspaceFence('workspace_01');assert.equal(fence.state,'ACTIVE');observed=true;}if(method==='finishRepoFileOperation'&&block)throw Error('Lost edit acknowledgement with Runner barrier');return f.storage.request(method,input);}},service=await f.service(proxy);
 const first=await service.call('repo.writeFile',op(),{...basis,path,expectedSha256:sha(before),text:'export const count = 7;\n'});assert.equal(first.state,'SUCCEEDED');assert.equal(observed,true);await assert.rejects(f.runner.client.activeWorkspaceFence('workspace_01'),{status:404});
 const start={schemaVersion:'devmesh.runner-job.v1',operationId:op(),permit:{...f.permit,notBefore:new Date(Math.max(Date.parse(f.permit.notBefore),Date.parse(f.permit.expiresAt)-15000)).toISOString()},imageDigest:image,workspaceRef:'workspace_01',commandSpec:{kind:'build'},resourceLimits:{cpu:1,memoryMiB:128,pids:32,temporaryMiB:32,timeoutMs:60000},networkPolicyRef:'none',outputSpec:[]},queued=await f.runner.client.start(start);
 await assert.rejects(service.call('repo.workspaceRead',op(),{...basis,path}),{code:'RUNNER_CONFLICT'});
 const deniedEdit=op(),deniedCommit=op();await assert.rejects(service.call('repo.writeFile',deniedEdit,{...basis,path,expectedSha256:first.sha256,text:'must not replace code while queued\n'}),{code:'RUNNER_CONFLICT'});
 assert.equal((await service.call('repo.fileByOperation',op(),{operationId:deniedEdit})).state,'FAILED');
 await assert.rejects(service.call('repo.commit',deniedCommit,f.args),{code:'RUNNER_CONFLICT'});assert.equal((await service.call('repo.by-operation',op(),{operationId:deniedCommit})).state,'FAILED');
 assert.equal(await readFile(join(f.root,path),'utf8'),'export const count = 7;\n');assert.equal(f.runner.backend.starts.length,0);await f.runner.client.stop(queued.jobId);
 block=true;const id=op(),text='export const count = 8;\n';await assert.rejects(service.call('repo.writeFile',id,{...basis,path,expectedSha256:first.sha256,text}),{outcome:'unknown'});
 const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});block=false;
 const recovered=await service.call('repo.fileByOperation',op(),{operationId:id});assert.equal(recovered.state,'SUCCEEDED');assert.equal(recovered.sha256,sha(text));assert.equal((await f.runner.client.get(queued.jobId)).state,'EXITED');assert.equal(f.runner.backend.starts.length,0);await assert.rejects(f.runner.client.activeWorkspaceFence('workspace_01'),{status:404});
});
