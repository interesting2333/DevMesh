import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {docsTools,serveMcp,McpToolClient} from '../packages/mcp-tools/dist/index.mjs';
import {contentFixture,meta} from './fixtures/content-data.mjs';

async function fixture(t){
  const f=await contentFixture(t),text='第一段：任务看板😀。\n\n第二段：容量与任务验收。\n\n第三段：任务归档。';
  const body=await f.content.putText(meta(),{kind:'content'},text);
  const p=(await f.storage.request('createProjectWithRun',{meta:meta(),name:'文档来源',baseCommit:'a'.repeat(40),contentHash:body.expectedHash,clientMessageId:randomUUID()})).result;
  const document={documentRef:'requirements.original',version:'v1',resourceId:'dataset.original',runId:p.runId,principalId:'user_1',reference:{kind:'artifact',artifactId:p.artifactId},sha256:body.expectedHash,byteSize:Buffer.byteLength(text)};
  const tools=docsTools(f.content,[document]),secret='docs-service-test-secret-only';
  const server=await serveMcp({serviceId:'docs.original',version:'1.0.0',identities:[{controllerId:'docs.consumer',credentialRef:'docs.local',allowedTools:tools.map(t=>t.name)}],credentials:async()=>secret,authority:{async authorize(){}},tools});
  const client=new McpToolClient({endpointId:'docs.original',endpoint:server.endpoint,credentialRef:'docs.local',credentials:async()=>secret});
  t.after(async()=>{await client.close();await server.close();});await client.connect();
  const permit={schemaVersion:'devmesh.permit.v1',ownerKind:'workflowAttempt',runId:p.runId,runEpoch:1,workId:'work_docs',workEpoch:1,attemptId:'attempt_docs',activationId:'activation_docs',grantId:'grant_docs',notBefore:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),resources:[{kind:'dataset',resourceId:document.resourceId,access:'read'}]};
  return {...f,text,document,tools,client,permit,call:(name,args,p=permit)=>client.call(name,'op_'+randomUUID().replaceAll('-',''),p,args)};
}

test('docs reads pinned original bytes and searches with exact Unicode offsets and paragraph provenance',async t=>{
  const f=await fixture(t),ref={documentRef:f.document.documentRef,version:'v1'};
  const read=await f.call('docs.read',{...ref,startOffset:0,limit:12});
  assert.equal(read.text,f.text.slice(read.startOffset,read.endOffset));assert.deepEqual(read.reference,f.document.reference);assert.equal(read.sha256,f.document.sha256);
  assert.equal(read.offsetUnit,'utf16-code-unit');assert.ok(read.truncated);
  const result=await f.call('docs.search',{documents:[ref],query:'任务',limit:2});
  assert.equal(result.matches.length,2);assert.equal(result.truncated,true);assert.deepEqual(result.matches.map(m=>m.paragraph),[1,2]);
  for(const m of result.matches){assert.equal(f.text.slice(m.startOffset,m.endOffset),'任务');assert.equal(f.text.slice(m.excerpt.startOffset,m.excerpt.endOffset),m.excerpt.text);assert.deepEqual(m.reference,f.document.reference);}
  const emoji=f.text.indexOf('😀');await assert.rejects(f.call('docs.read',{...ref,startOffset:emoji+1}),{code:'MCP_DOCUMENT_OFFSET_INVALID'});
});

test('docs refuses ungranted documents, another run, a mixed query and source hash drift',async t=>{
  const f=await fixture(t),ref={documentRef:f.document.documentRef,version:'v1'};
  await assert.rejects(f.call('docs.read',ref,{...f.permit,resources:[{kind:'dataset',resourceId:'dataset.other',access:'read'}]}),{code:'MCP_DOCUMENT_DENIED'});
  await assert.rejects(f.call('docs.read',ref,{...f.permit,runId:'run_other'}),{code:'MCP_DOCUMENT_DENIED'});
  await assert.rejects(f.call('docs.search',{documents:[ref,{documentRef:'private',version:'v1'}],query:'任务'}),{code:'MCP_DOCUMENT_DENIED'});
  const changed=docsTools(f.content,[{...f.document,sha256:'f'.repeat(64)}]).find(t=>t.name==='docs.read');
  await assert.rejects(changed.execute({args:ref,permit:f.permit,controllerId:'docs.consumer',operationId:'op_hash',signal:new AbortController().signal}),{code:'MCP_DOCUMENT_CHANGED'});
  const exact=await f.call('docs.search',{documents:[ref],query:'任务',limit:3});assert.equal(exact.truncated,false);assert.equal(exact.matches.length,3);
  const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));
  try{assert.equal(db.prepare("SELECT count(*) AS n FROM storage_pins WHERE state='ACTIVE'").get().n,0);}finally{db.close();}
});
