import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {contentFixture} from './content-data.mjs';
import {manifest,callerId,serviceToken} from './a2a-data.mjs';
import {createRoleCard,cardHash} from '../../packages/a2a-adapter/dist/index.mjs';
import {startPlatform} from '../../packages/platform-core/dist/index.mjs';

/** Actual optional platform assembly; model responses and identity are explicit local fixtures. */
export async function modelWorkbenchFixture(t,{truncate=false}={}){
 const cleanups=[],f=await contentFixture({after:callback=>cleanups.push(callback)}),middle=Promise.withResolvers(),finish=Promise.withResolvers(),received=Promise.withResolvers();
 const state={available:false,calls:0,requests:[],sockets:[],body:'',principalId:'user_1'};let platform;
 const model=createServer(async(req,res)=>{
  let raw='';for await(const bytes of req)raw+=bytes;const request=JSON.parse(raw);state.requests.push(request);state.calls++;state.available=false;
  const input=JSON.parse(request.messages[1].content),ref=input.manifest.sources.find(source=>source.ref.kind==='message').ref;
  const value={schemaVersion:'devmesh.understanding.v1',role:'product',requirements:[{id:'requirement_stream',statement:'本地协议验证结果 🧪 <script>不执行</script>',sourceRefs:[ref],acceptance:['准确保存']}],assumptions:[],questions:[],conflicts:[]};
  state.body=JSON.stringify(value);const width=Math.ceil(state.body.length/3),frame=(text,reason=null)=>'data: '+JSON.stringify({id:'platform-local-sse',model:'fixture-model',choices:[{index:0,delta:{content:text},finish_reason:reason}],...(reason?{usage:{prompt_tokens:50,completion_tokens:60}}:{})})+'\n\n';
  res.writeHead(200,{'content-type':'text/event-stream'});res.write(frame(state.body.slice(0,width)));received.resolve();await middle.promise;if(res.destroyed)return;res.write(frame(state.body.slice(width,width*2)));await finish.promise;if(res.destroyed)return;if(truncate)res.end();else res.end(frame(state.body.slice(width*2),'stop')+'data: [DONE]\n\n');
 });
 t.after(async()=>{middle.resolve();finish.resolve();try{await platform?.stop();}finally{model.closeAllConnections();await new Promise(resolve=>model.close(()=>resolve()));for(const callback of cleanups)await callback();}});
 await new Promise(resolve=>model.listen(0,'127.0.0.1',resolve));
 // Reserve a fresh local test port, then build Cards before starting the host.
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));const origin='http://127.0.0.1:'+port,m=manifest(origin);
 for(const endpoint of m.endpoints.filter(item=>['product','architect'].includes(item.role))){endpoint.supportedSkills.push('devmesh.prepare.'+endpoint.role);endpoint.cardHash=cardHash(createRoleCard(endpoint));}
 await f.local.close();
 const provider={providerId:'local.sse',endpoint:'http://127.0.0.1:'+model.address().port,model:'fixture-model',credentialRef:'fixture.model',responseMode:'sse',capabilities:{revision:'local.sse.v1',contextTokens:128000,maxOutputTokens:4096,toolCalls:true,structuredOutput:'json-object',tokenCounting:'utf8-conservative-v1',reasoningMode:'disabled',verification:'DECLARED'},requestTimeoutMs:120000};
 const config={host:'127.0.0.1',port,shutdownTimeoutMs:1000,storage:f.options,inputApi:{repositoryRoot:process.cwd(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),templatePath:'templates/web-crud-v1'},a2a:{manifest:m,identities:[{principalId:callerId,credentialRef:'test.service'}],healthIntervalMs:60000},runtime:{providers:[provider],tokenLimit:100000,preparation:{callerId,productProviderId:provider.providerId,architectProviderId:provider.providerId,maxInputBytes:256*1024,maxOutputTokens:1024,bootstrapPaths:[]}}};
 platform=await startPlatform(config,{identityResolver:request=>{if(request.headers.upgrade==='websocket')state.sockets.push(request.socket);return {principalId:state.principalId};},resolveCredential:async ref=>ref==='test.service'?serviceToken:ref==='fixture.model'&&state.available?'local-test-model-key':undefined});
 const storage=platform.services.local.storage,content=platform.services.content;
 const call=async(path,init={})=>{const response=await fetch(origin+'/api/v1'+path,{...init,signal:AbortSignal.timeout(15000)});return {status:response.status,body:await response.json()};};
 const create=async()=>{const result=await call('/projects',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({initialRequest:{text:'本地真实协议链验证',attachmentIds:[]},clientDraftId:randomUUID()})});assert.equal(result.status,201,JSON.stringify(result.body));return result.body.result;};
 const sql=(query,...args)=>{const db=new DatabaseSync(join(f.options.dataRoot,'db/devmesh.sqlite'));try{db.exec('PRAGMA busy_timeout=5000');return db.prepare(query).all(...args);}finally{db.close();}};
 return {platform,state,origin,storage,content,create,sql,received:received.promise,advance:()=>middle.resolve(),finish:()=>finish.resolve()};
}
