import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {issueTools,workflowToolAuthority,serveMcp,McpToolClient,runtimeMcpTools} from '../packages/mcp-tools/dist/index.mjs';
import {httpFixture,prepareDispatch} from './fixtures/a2a-data.mjs';
import {meta} from './fixtures/storage-data.mjs';

const op=()=> 'op_'+randomUUID().replaceAll('-','');
async function fixture(t){
  const f=await httpFixture(t),toolNames=['issues.create','issues.linkFix','issues.recordVerification','issues.get','issues.by-operation'];
  const p=await prepareDispatch(f,f.registry,{allowedTools:toolNames.map(n=>n.replaceAll('.','_'))});
  await f.storage.request('acceptA2AWork',p.request);await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'issue.fixture'});
  const sql=(query,...params)=>{const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));try{return db.prepare(query).all(...params);}finally{db.close();}};
  const permit=JSON.parse(sql('SELECT permit_json FROM execution_grants WHERE attempt_id=?',p.attemptId)[0].permit_json);
  const artifact=sql('SELECT content_hash FROM artifacts WHERE artifact_id=?',p.artifactId)[0];
  const evidence={artifactId:p.artifactId,sha256:artifact.content_hash},args={title:'容量校验缺失',description:'复现输入与预期行为已保存在来源中',severity:'HIGH',evidence};
  async function service(storage){
    const tools=issueTools(storage),authority=workflowToolAuthority(storage,new Map([['issue.controller',new Set(toolNames)]])),secret='issues-local-test-secret';
    const server=await serveMcp({serviceId:'issues.local',version:'1.0.0',identities:[{controllerId:'issue.controller',credentialRef:'issues.local',allowedTools:toolNames}],credentials:async()=>secret,authority,tools});
    const client=new McpToolClient({endpointId:'issues.local',endpoint:server.endpoint,credentialRef:'issues.local',credentials:async()=>secret});
    await client.connect();let closed=false;const close=async()=>{if(closed)return;closed=true;await client.close();await server.close();};t.after(close);
    return {client,tools,close,call:(name,id,args,identity=permit)=>client.call(name,id,identity,args)};
  }
  return {...f,p,permit,evidence,args,sql,service,...await service(f.storage)};
}

test('issues mutate through MCP with original keys, revision checks and bounded immutable history',async t=>{
  const f=await fixture(t),id=op(),created=await f.call('issues.create',id,f.args);
  assert.equal(created.issueRevision,1);assert.deepEqual(await f.call('issues.create',id,f.args),created);
  await assert.rejects(f.call('issues.create',id,{...f.args,title:'Changed original request'}),{code:'IDEMPOTENCY_KEY_REUSED'});
  const linkId=op(),link={issueId:created.issueId,issueRevision:1,fixWorkId:f.p.delegation.workId};
  const linked=await f.call('issues.linkFix',linkId,link);assert.equal(linked.issueRevision,2);
  assert.deepEqual(await f.call('issues.linkFix',linkId,link),linked);
  await assert.rejects(f.call('issues.linkFix',op(),link),{code:'ISSUE_REVISION_CHANGED'});
  const verification={issueId:created.issueId,issueRevision:2,fixAttemptId:f.p.attemptId,verificationAttemptId:null,outcome:'PASSED',evidence:f.evidence};
  await assert.rejects(f.call('issues.recordVerification',op(),verification),{code:'ISSUE_VERIFICATION_UNPROVEN'});
  const recorded=await f.call('issues.recordVerification',op(),{...verification,outcome:'NOT_VERIFIED'});assert.equal(recorded.issueRevision,3);
  const page=await f.call('issues.get',op(),{issueId:created.issueId,limit:2});assert.equal(page.revision,3);assert.equal(page.state,'FIX_LINKED');assert.equal(page.history.length,2);assert.equal(page.nextRevision,2);
  const last=await f.call('issues.get',op(),{issueId:created.issueId,afterRevision:page.nextRevision});assert.equal(last.history[0].kind,'VERIFICATION_RECORDED');assert.equal(last.nextRevision,null);
  assert.equal(f.sql('SELECT count(*) AS n FROM issues')[0].n,1);assert.equal(f.sql('SELECT count(*) AS n FROM issue_revisions')[0].n,3);
  assert.equal(f.sql("SELECT count(*) AS n FROM events WHERE run_id=? AND type='IssueChanged'",f.p.runId)[0].n,3);
  assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);
});

test('an issue or source in another Run is not visible through a valid different host',async t=>{
  const f=await fixture(t),id=op(),created=await f.call('issues.create',id,f.args);
  const other=await prepareDispatch(f,f.registry,{allowedTools:f.tools.map(t=>t.name.replaceAll('.','_'))});
  await f.storage.request('acceptA2AWork',other.request);await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'issue.other'});
  const permit=JSON.parse(f.sql('SELECT permit_json FROM execution_grants WHERE attempt_id=?',other.attemptId)[0].permit_json);
  await assert.rejects(f.call('issues.get',op(),{issueId:created.issueId},permit),{code:'ISSUE_NOT_FOUND'});
  await assert.rejects(f.call('issues.by-operation',op(),{operationId:id},permit),{code:'ISSUE_OPERATION_NOT_FOUND'});
  await assert.rejects(f.call('issues.create',op(),f.args,permit),{code:'ISSUE_EVIDENCE_UNAVAILABLE'});
  assert.equal(f.sql('SELECT count(*) AS n FROM issues')[0].n,1);
});

test('paused or revoked grants cannot create issues but original results remain queryable after restart',async t=>{
  const f=await fixture(t),id=op(),created=await f.call('issues.create',id,f.args),run=await f.storage.request('getRun',{runId:f.p.runId});
  await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});
  await assert.rejects(f.call('issues.create',op(),f.args),{code:'MCP_AUTHORITY_DENIED'});
  assert.deepEqual(await f.call('issues.by-operation',op(),{operationId:id}),created);
  const forged={...f.permit,resources:[...f.permit.resources,{kind:'dataset',resourceId:'another.dataset',access:'read'}]};
  await assert.rejects(f.call('issues.by-operation',op(),{operationId:id},forged),{code:'MCP_AUTHORITY_DENIED'});
  const bridged=runtimeMcpTools(f.client,f.tools.filter(t=>t.name==='issues.create'))[0];
  const recovered=await bridged.query(id,{permit:f.permit});assert.equal(recovered.state,'SUCCEEDED');assert.deepEqual(recovered.value.result,created);
  await f.close();await f.agents.stop();await f.local.close();const reopened=await f.reopen(),second=await f.service(reopened.storage);
  assert.deepEqual(await second.call('issues.by-operation',op(),{operationId:id}),created);
  assert.equal((await second.call('issues.get',op(),{issueId:created.issueId})).history.length,1);
  assert.equal(f.sql('SELECT count(*) AS n FROM issues')[0].n,1);
});
