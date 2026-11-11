import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
import {z} from '../packages/mcp-tools/node_modules/zod/index.js';
import {McpToolClient,serveMcp,repoTools,testTools,runtimeMcpTools,ToolError} from '../packages/mcp-tools/dist/index.mjs';
import {RunnerClient,serveRunner} from '../packages/runner/dist/index.mjs';
import {fixture,request,image} from './fixtures/runner.mjs';
const key='local-mcp-test-service-secret';
const hash=v=>createHash('sha256').update(v).digest('hex');
async function repo(t){const root=await mkdtemp(join(tmpdir(),'devmesh-mcp-repo-'));t.after(()=>rm(root,{recursive:true,force:true}));const text='export const answer = 42;\n';await writeFile(join(root,'code.ts'),text);const tools=repoTools([{snapshotRef:'snapshot.test',resourceId:'snapshot.resource',root,files:[{path:'code.ts',sha256:hash(text),byteSize:Buffer.byteLength(text)}]}]);return {root,text,tools};}
function permit(){const p=request().permit;p.resources.push({kind:'snapshot',resourceId:'snapshot.resource',access:'read'});return p;}
async function service(t,tools,extra={}){
 const options={serviceId:'mcp.test',version:'1.0.0',identities:[{controllerId:'controller.local',credentialRef:'mcp.local',allowedTools:tools.map(t=>t.name)}],credentials:async()=>key,authority:{async authorize(controller){if(controller!=='controller.local')throw Error('denied');}},tools,...extra};
 const server=await serveMcp(options);let client;const cleanup=async()=>{await client?.close();await server.close();};if(t)t.after(cleanup);client=new McpToolClient({endpointId:options.serviceId,endpoint:server.endpoint,credentialRef:'mcp.local',credentials:async()=>key});await client.connect();return {server,client,options,cleanup};
}
test('official MCP initialize/list/call over real HTTP reads a verified snapshot and records capabilities',async t=>{
 const r=await repo(t),s=await service(t,r.tools),p=permit();assert.ok(s.client.snapshot.protocolVersion);assert.equal(s.client.snapshot.server.name,'mcp.test');assert.equal(s.client.snapshot.tools.length,2);
 const result=await s.client.call('repo.read','op_read',p,{snapshotRef:'snapshot.test',path:'code.ts'});assert.equal(result.text,r.text);assert.equal(result.sha256,hash(r.text));assert.ok(Object.isFrozen(s.client.snapshot.tools));
 const bridge=runtimeMcpTools(s.client,r.tools);assert.deepEqual(bridge.map(t=>t.name),['repo_list','repo_read']);assert.ok(!JSON.stringify(bridge[1].schema.shape).includes('operationId'));const got=await bridge[1].execute('op_bridge',{snapshotRef:'snapshot.test',path:'code.ts'},{permit:p},new AbortController().signal);assert.equal(got.state,'SUCCEEDED');assert.equal(got.value.source,'mcp');assert.equal(got.value.result.text,r.text);assert.ok(!JSON.stringify(bridge[1].connection).includes(key));
});
test('MCP service denies anonymous, browser Origin, hostile Host and unapproved tools',async t=>{
 const r=await repo(t),s=await service(t,r.tools);for(const headers of [{},{Authorization:'Bearer '+key,Origin:'https://evil.example'}]){const response=await fetch(s.server.endpoint,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{}'});assert.ok([401,403].includes(response.status));}
 const hostile=await new Promise((resolve,reject)=>{const req=httpRequest(s.server.endpoint,{method:'POST',headers:{Host:'evil.example',Authorization:'Bearer '+key,'Content-Type':'application/json'}},res=>{res.resume();resolve(res.statusCode);});req.once('error',reject);req.end('{}');});assert.equal(hostile,403);
 await assert.rejects(s.client.call('tests.start','op_denied',permit(),{}),{code:'MCP_TOOL_UNAVAILABLE'});
});
test('repo tool rejects hash changes, unauthorized paths and linked files without leaking host data',async t=>{
 const r=await repo(t),s=await service(t,r.tools),p=permit();await writeFile(join(r.root,'code.ts'),'x'.repeat(Buffer.byteLength(r.text)));await assert.rejects(s.client.call('repo.read','op_changed',p,{snapshotRef:'snapshot.test',path:'code.ts'}),{code:'MCP_SNAPSHOT_CHANGED'});
 await assert.rejects(s.client.call('repo.read','op_escape',p,{snapshotRef:'snapshot.test',path:'../secret'}));
 await assert.rejects(s.client.call('repo.read','op_other',request().permit,{snapshotRef:'snapshot.test',path:'code.ts'}),{code:'MCP_SNAPSHOT_DENIED'});
 await rm(join(r.root,'code.ts'));await writeFile(join(r.root,'outside.txt'),r.text);await symlink(join(r.root,'outside.txt'),join(r.root,'code.ts'));await assert.rejects(s.client.call('repo.read','op_link',p,{snapshotRef:'snapshot.test',path:'code.ts'}),{code:'MCP_SNAPSHOT_CHANGED'});
 assert.throws(()=>repoTools([{snapshotRef:'x',resourceId:'x',root:r.root,files:[{path:'.env',sha256:'a'.repeat(64),byteSize:1}]}]),{code:'MCP_SNAPSHOT_CONFIGURATION_INVALID'});
});
test('connection revalidation refuses a changed signature instead of replacing its frozen snapshot',async t=>{
 const r=await repo(t),s=await service(null,r.tools);let next;t.after(async()=>{await s.cleanup();await next?.close();});const previous=s.client.snapshot.sha256,port=s.server.address.port;await s.server.close();next=await serveMcp({...s.options,port,version:'2.0.0'});await assert.rejects(s.client.connect(),{code:'MCP_SCHEMA_CHANGED'});assert.equal(s.client.snapshot.sha256,previous);await assert.rejects(s.client.call('repo.read','op_no_reconnect',permit(),{}),{code:'MCP_TOOL_UNAVAILABLE'});
});
test('real MCP to Runner HTTP admits one job, enforces host ownership and allows stop after write gate closes',async t=>{
 const f=await fixture(t),runnerKey='local-runner-mcp-service-key',http=await serveRunner(f.manager,{identities:[{controllerId:'controller.local',credentialRef:'runner.local'}],credentials:async()=>runnerKey});f.cleanup.push(()=>http.close());
 const runner=new RunnerClient('http://127.0.0.1:'+http.address.port,'runner.local',async()=>runnerKey),base=request(),tools=testTools(runner,[{checkId:'unit',imageDigest:image,commandSpec:{kind:'unit'},resourceLimits:base.resourceLimits,networkPolicyRef:'none',outputSpec:[]}]);
 // This fixture's fixed Runner policy permits build only; configure the approved
 // check accordingly so neither model nor transport supplies arbitrary argv.
 const checks=testTools(runner,[{checkId:'unit',imageDigest:image,commandSpec:{kind:'build'},resourceLimits:base.resourceLimits,networkPolicyRef:'none',outputSpec:[]}]);let open=true;
 const s=await service(null,checks,{authority:{async authorize(_controller,_tool,_permit,action){if(action==='write'&&!open)throw Error('closed');}}});f.cleanup.push(s.cleanup);assert.equal(tools.length,4);
 const first=await s.client.call('tests.start','op_mcp_job',base.permit,{checkId:'unit',workspaceRef:'workspace1'}),same=await s.client.call('tests.start','op_mcp_job',base.permit,{checkId:'unit',workspaceRef:'workspace1'});assert.equal(first.jobId,same.jobId);assert.equal(first.state,'QUEUED');assert.equal((await f.layout.store.request('inspect',{})).jobs,1);
 open=false;await assert.rejects(s.client.call('tests.start','op_no_start',base.permit,{checkId:'unit',workspaceRef:'workspace1'}),{code:'MCP_AUTHORITY_DENIED'});
 const other=request(2).permit;await assert.rejects(s.client.call('tests.get','op_other_read',other,{jobId:first.jobId}),{code:'MCP_JOB_NOT_FOUND'});
 assert.equal((await s.client.call('tests.stop','op_stop',base.permit,{jobId:first.jobId})).stopRequested,true);assert.equal((await s.client.call('tests.by-operation','op_query',base.permit,{operationId:'op_mcp_job'})).jobId,first.jobId);
});
test('lost MCP start reply reconciles the original operation without resending mutation',async t=>{
 const f=await fixture(t),runnerKey='runner-lost-reply-service-token',http=await serveRunner(f.manager,{identities:[{controllerId:'controller.local',credentialRef:'runner.local'}],credentials:async()=>runnerKey});f.cleanup.push(()=>http.close());const runner=new RunnerClient('http://127.0.0.1:'+http.address.port,'runner.local',async()=>runnerKey),r=request(),tools=testTools(runner,[{checkId:'build',imageDigest:image,commandSpec:{kind:'build'},resourceLimits:r.resourceLimits,networkPolicyRef:'none',outputSpec:[]}]),s=await service(null,tools);f.cleanup.push(s.cleanup);
 let starts=0,queries=0;const proxy=createServer(async(req,res)=>{try{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw),name=body.params?.name;if(name==='tests.start')starts++;if(name==='tests.by-operation')queries++;const upstream=await fetch(s.server.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:req.headers.accept??'application/json, text/event-stream',Authorization:'Bearer '+key,...(req.headers['mcp-protocol-version']?{'MCP-Protocol-Version':req.headers['mcp-protocol-version']}:{})},body:raw});const bytes=await upstream.arrayBuffer();if(name==='tests.start'){res.destroy();return;}res.writeHead(upstream.status,Object.fromEntries(upstream.headers));res.end(Buffer.from(bytes));}catch{res.destroy();}});await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));f.cleanup.push(async()=>{proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));});
 const client=new McpToolClient({endpointId:'mcp.proxy',endpoint:'http://127.0.0.1:'+proxy.address().port+'/mcp',credentialRef:'mcp.local',credentials:async()=>key});f.cleanup.push(()=>client.close());await client.connect();const start=runtimeMcpTools(client,tools.filter(t=>t.name==='tests.start'))[0],host={permit:r.permit};assert.equal((await start.execute('op_lost_reply',{checkId:'build',workspaceRef:'workspace1'},host,new AbortController().signal)).state,'OUTCOME_UNKNOWN');const result=await start.query('op_lost_reply',host);assert.equal(result.state,'SUCCEEDED');assert.equal(result.value.result.operationId,'op_lost_reply');assert.equal(starts,1);assert.equal(queries,1);assert.equal((await f.layout.store.request('inspect',{})).jobs,1);
});
test('missing MCP credentials and deadline never trigger automatic tool call retries',async t=>{
 await assert.rejects(new McpToolClient({endpointId:'x',endpoint:'http://127.0.0.1:1/mcp',credentialRef:'x',credentials:async()=>undefined}).connect(),{code:'MCP_NOT_CONFIGURED'});
  let calls=0,release;const held=new Promise(resolve=>{release=resolve;}),tool={name:'slow.read',description:'Controlled deadline fixture',schema:z.strictObject({}),action:'read',effectClass:'READ',async execute(){calls++;await held;return 'done';}},s=await service(t,[tool]);
  // Initialize with the normal connection budget. Keep the accepted operation
  // pending until its call deadline, independent of machine scheduling speed.
  try{await assert.rejects(s.client.call('slow.read','op_timeout',permit(),{}),error=>error instanceof ToolError&&error.outcome==='unknown');assert.equal(calls,1);}finally{release();}
});
test('oversized MCP responses remain unknown and do not replay the original tool',async t=>{
 let calls=0;const tool={name:'large.read',description:'Response budget fixture',schema:z.strictObject({}),action:'read',effectClass:'READ',async execute(){calls++;return 'x'.repeat(600000);}},s=await service(t,[tool]);await assert.rejects(s.client.call('large.read','op_large',permit(),{}),error=>error instanceof ToolError&&error.outcome==='unknown');assert.equal(calls,1);
});
