import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {AgentRuntime,DeepSeekProvider} from '../packages/agent-runtime/dist/index.mjs';
import {createLocalManagedRuntimeLifecycle,ControlledGit} from '../packages/code-workspaces/dist/index.mjs';
import {managedRunnerFixture} from './fixtures/managed-runner.mjs';
import {meta,canonical} from './fixtures/storage-data.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const allowedTools=['repo_writeFile','repo_commit','repo_by-operation'];
const capabilities={revision:'managed.local.v1',contextTokens:32768,maxOutputTokens:4096,toolCalls:true,structuredOutput:'json-object',tokenCounting:'utf8-conservative-v1',reasoningMode:'disabled',verification:'DECLARED'};
const answer=(content,calls=[])=>({id:'local-managed-response',model:'test.model',choices:[{index:0,finish_reason:calls.length?'tool_calls':'stop',message:{role:'assistant',content,tool_calls:calls.map(c=>({id:c.id,type:'function',function:{name:c.name,arguments:JSON.stringify(c.args)}}))}}],usage:{prompt_tokens:50,completion_tokens:25}});
async function fixture(t,options={}){
 const f=await managedRunnerFixture(t,{mcp:true,deferAllocation:true,scheduled:options.scheduled,allowedTools,role:{provider:'test.provider',outputSchemaId:'devmesh.development-result.v1',requestTimeoutMs:30000,contextLimitTokens:32768}}),requests=[];
 let output;
 const server=createServer(async(req,res)=>{try{let body='';for await(const chunk of req)body+=chunk;const request=JSON.parse(body);requests.push(request);
  assert.equal(f.sql("SELECT state FROM workspace_allocations")[0].state,'READY');
  const context=JSON.parse(request.messages.find(m=>m.role==='user').content);assert.equal(context.workspace.baseCommit,f.base);assert.equal(context.workspace.workspaceRef,'workspace_01');assert.equal(JSON.stringify(context).includes(f.options.runnerDataRoot),false);
  const args={workspaceRef:'workspace_01',baseCommit:f.base};
  if(requests.length===1)res.end(JSON.stringify(answer('',[{id:'write_1',name:'repo_writeFile',args:{...args,path:'src/board.ts',expectedSha256:hash('export const count = 0;\n'),text:'export const count = 7;\n'}}])));
  else if(requests.length===2){assert.equal(JSON.parse(request.messages.at(-1).content).state,'SUCCEEDED');res.end(JSON.stringify(answer('',[{id:'commit_1',name:'repo_commit',args:{...args,message:'Managed Runtime candidate'}}])));}
  else {const result=JSON.parse(request.messages.at(-1).content);assert.equal(result.state,'SUCCEEDED');output={schemaVersion:'devmesh.development-result.v1',role:'developer',baseCommit:f.base,resultCommit:options.inventCommit?'f'.repeat(40):result.value.result.commit,changedFiles:['src/board.ts'],checkRefs:[],unverified:['Local HTTP fixture; no production model or container'],handoffProposal:null};res.end(JSON.stringify(answer(JSON.stringify(output))));}
 }catch(e){t.diagnostic(e.stack);res.statusCode=500;res.end('{}');}});
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const provider=new DeepSeekProvider({providerId:'test.provider',endpoint:'http://127.0.0.1:'+server.address().port,model:'test.model',credentialRef:'fixture.model',capabilities,requestTimeoutMs:30000},async()=>'local-protocol-fixture');
 const real=createLocalManagedRuntimeLifecycle({mode:'local-development',allocator:f.allocator,archives:f.service(f.storage)}),lifecycle=options.wrap?options.wrap(real,f):real;
 const runtime=new AgentRuntime(f.storage,f.content,[provider],f.mcp.tools,100000,lifecycle);
 const withDb=fn=>{const opened=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));try{return fn(opened);}finally{opened.close();}},db={exec:sql=>withDb(d=>d.exec(sql)),prepare:sql=>({run:(...params)=>withDb(d=>d.prepare(sql).run(...params))})};
 return {...f,requests,runtime,real,lifecycle,db,output:()=>output,provider};
}
test('managed Runtime allocates before real HTTP model calls, commits through MCP and requires retained source before atomic A2A completion',async t=>{
 const f=await fixture(t,{scheduled:true,wrap:(real,f)=>({...real,async retain(host,result,signal){
  assert.equal(f.sql('SELECT count(*) n FROM runtime_workspace_results')[0].n,1);assert.equal(f.sql('SELECT count(*) n FROM runtime_results')[0].n,0);
  await assert.rejects(f.storage.request('publishRuntimeResult',{activationId:host.activationId,stepNo:result.stepNo,contentHash:result.contentHash,output:result.output}),e=>e.code==='RUNTIME_SOURCE_ARCHIVE_UNACKNOWLEDGED');
  return real.retain(host,result,signal);
 }})});
 assert.equal(f.sql('SELECT count(*) n FROM workspace_allocations')[0].n,0);const result=await f.runtime.execute(f.claim);assert.equal(result.state,'completed',JSON.stringify(result));assert.equal(f.requests.length,3);
 const archive=f.sql('SELECT * FROM source_archives')[0],journal=f.sql('SELECT * FROM runtime_workspace_results')[0];assert.equal(archive.state,'ACKNOWLEDGED');assert.equal(archive.operation_id,journal.archive_operation_id);assert.equal(JSON.parse(archive.acknowledgement_json).commit,f.output().resultCommit);
 assert.deepEqual(JSON.parse(await f.content.readText('user_1',{kind:'artifact',artifactId:result.candidate.artifactId})),f.output());
 assert.equal(f.sql('SELECT state FROM accepted_work')[0].state,'FINISHED');assert.notEqual((await f.storage.request('getAttempt',{attemptId:f.p.attemptId})).state,'SUCCEEDED');assert.equal(f.backend.starts.length,0);
 assert.equal(f.sql('SELECT state FROM scheduled_dispatch_delivery')[0].state,'ACKED');
 const current=JSON.parse(f.sql('SELECT permit_json FROM execution_grants')[0].permit_json);await assert.rejects(f.client.start(f.job(current)),{status:403});
 assert.throws(()=>f.db.prepare('UPDATE runtime_workspace_results SET output_json=?').run('{}'),/RUNTIME_WORKSPACE_RESULT_IMMUTABLE/);
 assert.deepEqual(await f.runtime.reconcileWorkspaceResult(f.claim),result);assert.equal(f.requests.length,3);
});
test('lost original source ACK recovers after pause without a model call, commit replay, transfer replay or Grant revival',async t=>{
 const f=await fixture(t);
 // Inject the loss after original refs have been retained but before SQLite ACK.
 f.db.exec("CREATE TRIGGER cut_managed_ack BEFORE UPDATE OF state ON source_archives WHEN NEW.state='ACKNOWLEDGED' BEGIN SELECT RAISE(ABORT,'ack-cut'); END");
 const first=await f.runtime.execute(f.claim);assert.equal(first.state,'reconcile',JSON.stringify(first));assert.equal(f.requests.length,3);assert.equal(f.sql('SELECT state FROM source_archives')[0].state,'PREPARED');assert.equal(f.sql('SELECT count(*) n FROM runtime_results')[0].n,0);
 await f.storage.request('reconcileRuntimeTask',{...f.claim,reason:'SOURCE_ACK_UNKNOWN'});const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+run.resourceRevision+'"',action:'pause'});await f.lease.stop();
 assert.equal((await f.runtime.reconcileWorkspaceResult({...f.claim,claimToken:'foreign.claim'})).code,'EXECUTION_HOST_CLAIM_CHANGED');
 const member=f.sql('SELECT role FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1')[0].role;
 f.db.prepare('UPDATE project_members SET role=? WHERE project_id=? AND principal_id=?').run('viewer',f.p.projectId,'user_1');assert.equal((await f.runtime.reconcileWorkspaceResult(f.claim)).code,'EXECUTION_HOST_ACL_CHANGED');f.db.prepare('UPDATE project_members SET role=? WHERE project_id=? AND principal_id=?').run(member,f.p.projectId,'user_1');
 f.db.prepare('UPDATE a2a_task_ownership SET cancel_requested=1 WHERE task_id=?').run(f.claim.taskId);assert.equal((await f.runtime.reconcileWorkspaceResult(f.claim)).code,'EXECUTION_CANCELED');f.db.prepare('UPDATE a2a_task_ownership SET cancel_requested=0 WHERE task_id=?').run(f.claim.taskId);
 f.db.exec('DROP TRIGGER cut_managed_ack');
 const original=ControlledGit.prototype.importCommit;let transfers=0;ControlledGit.prototype.importCommit=async function(...args){transfers++;return original.apply(this,args);};t.after(()=>{ControlledGit.prototype.importCommit=original;});
 const recovered=await f.runtime.reconcileWorkspaceResult(f.claim);assert.equal(recovered.state,'completed',JSON.stringify(recovered));assert.equal(f.requests.length,3);assert.equal(transfers,0);assert.equal(f.sql('SELECT count(*) n FROM repo_operations')[0].n,1);assert.equal(f.sql('SELECT count(*) n FROM source_archives')[0].n,1);assert.equal(f.sql('SELECT status FROM execution_grants')[0].status,'REVOKED');assert.equal(f.sql('SELECT control_gate FROM runs')[0].control_gate,'PAUSING');
 assert.equal((await f.runtime.execute(f.claim)).state,'failed');assert.equal(f.requests.length,3);assert.equal(f.backend.starts.length,0);
});
test('managed final result journal rejects replacing its original commit',async t=>{
 const f=await fixture(t,{wrap:(real,f)=>({...real,async retain(host,result,signal){const changed={...result.output,resultCommit:'f'.repeat(40)};await assert.rejects(f.storage.request('prepareRuntimeWorkspaceResult',{activationId:host.activationId,stepNo:result.stepNo,contentHash:hash(canonical(changed)),output:changed}),e=>e.code==='RUNTIME_WORKSPACE_RESULT_IMMUTABLE');return real.retain(host,result,signal);}})});
 const result=await f.runtime.execute(f.claim);assert.equal(result.state,'completed',JSON.stringify(result));assert.equal(f.sql('SELECT count(*) n FROM runtime_workspace_results')[0].n,1);assert.equal(f.requests.length,3);
});
test('a lost candidate publication receipt returns the existing atomic result without new execution',async t=>{
 const f=await fixture(t),request=f.storage.request.bind(f.storage);let lost=true;
 f.storage.request=async(method,input)=>{const result=await request(method,input);if(method==='publishRuntimeResult'&&lost){lost=false;throw Error('publication receipt lost');}return result;};
 assert.equal((await f.runtime.execute(f.claim)).state,'reconcile');assert.equal(f.sql('SELECT state FROM accepted_work')[0].state,'FINISHED');
 const result=await f.runtime.reconcileWorkspaceResult(f.claim);assert.equal(result.state,'completed',JSON.stringify(result));assert.equal(f.requests.length,3);assert.equal(f.sql('SELECT count(*) n FROM runtime_results')[0].n,1);assert.equal(f.sql('SELECT count(*) n FROM source_archives')[0].n,1);assert.equal(f.backend.starts.length,0);
});
test('an invented final commit cannot enter the result journal or trigger source archival',async t=>{
 const f=await fixture(t,{inventCommit:true}),result=await f.runtime.execute(f.claim);assert.equal(result.state,'reconcile');assert.equal(result.code,'RUNTIME_WORKSPACE_COMMIT_UNPROVEN');assert.equal(f.requests.length,3);assert.equal(f.sql('SELECT count(*) n FROM runtime_workspace_results')[0].n,0);assert.equal(f.sql('SELECT count(*) n FROM source_archives')[0].n,0);assert.equal(f.sql('SELECT count(*) n FROM runtime_results')[0].n,0);assert.equal(f.sql('SELECT state FROM workspace_allocations')[0].state,'READY');
 assert.equal((await f.runtime.reconcileWorkspaceResult(f.claim)).code,'RUNTIME_WORKSPACE_RESULT_UNPREPARED');assert.equal(f.requests.length,3);
});
test('an interrupted preparation with no model step cannot reenter its lifecycle on a second execute call',async t=>{
 let preparations=0;
 const f=await fixture(t,{wrap:real=>({...real,async prepare(host,signal){preparations++;await real.prepare(host,signal);throw Error('preparation receipt unknown');}})});
 assert.equal((await f.runtime.execute(f.claim)).state,'reconcile');assert.equal(f.requests.length,0);assert.equal(f.sql('SELECT state FROM workspace_allocations')[0].state,'READY');assert.equal(f.sql('SELECT state FROM runtime_activations')[0].state,'RECONCILE');
 assert.equal((await f.runtime.execute(f.claim)).code,'RUNTIME_RESUME_REQUIRES_RECONCILIATION');assert.equal(preparations,1);assert.equal(f.requests.length,0);assert.equal(f.sql('SELECT count(*) n FROM workspace_allocations')[0].n,1);
 assert.equal((await f.runtime.reconcileWorkspaceResult(f.claim)).code,'RUNTIME_WORKSPACE_RESULT_UNPREPARED');assert.equal(preparations,1);
});
