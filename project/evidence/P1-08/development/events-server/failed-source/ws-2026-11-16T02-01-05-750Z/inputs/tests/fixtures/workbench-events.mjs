import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {contentFixture} from './content-data.mjs';
import {startPlatform} from '../../packages/platform-core/dist/index.mjs';
import {workbenchEventFrame} from '../../packages/contracts/dist/index.js';
export const {WebSocket}=createRequire(new URL('../../packages/input-api/package.json',import.meta.url))('ws');
const deadline=10000;
export async function eventFixture(t,{limits={},resolver,shutdownTimeoutMs=1000}={}){
 const cleanups=[],f=await contentFixture({after:callback=>cleanups.push(callback)});
 let platform;const peers=new Set(),state={principalId:'user_1',upgradeSockets:[],resolver};
 t.after(async()=>{for(const peer of peers)peer.terminate();try{await platform?.stop();}finally{for(const callback of cleanups)await callback();}});
 await f.local.close();
 const config={host:'127.0.0.1',port:0,shutdownTimeoutMs,storage:f.options,inputApi:{repositoryRoot:process.cwd(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),templatePath:'templates/web-crud-v1'}};
 const identityResolver=(request,context)=>{
  if(request.headers.upgrade==='websocket')state.upgradeSockets.push(request.socket);
  if(state.resolver)return state.resolver(request,context);
  return request.headers.authorization==='Bearer events-owner'?{principalId:state.principalId}:null;
 };
 const reopen=async()=>{platform=await startPlatform(config,{identityResolver,workbenchEvents:limits});f.platform=platform;f.storage=platform.services.local.storage;f.content=platform.services.content;f.origin=`http://127.0.0.1:${platform.address.port}`;return platform;};
 await reopen();
 const call=async(path,init={})=>{const response=await fetch(f.origin+'/api/v1'+path,{...init,headers:{authorization:'Bearer events-owner',...init.headers},signal:AbortSignal.timeout(deadline)});const body=await response.json();return {response,body};};
 const create=async()=>{const {response,body}=await call('/projects',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({initialRequest:{text:'实时事件原始输入',attachmentIds:[]},clientDraftId:randomUUID()})});assert.equal(response.status,201,JSON.stringify(body));return body.result;};
 const workspace=scope=>f.storage.request('getInputWorkspace',{principalId:'user_1',projectId:scope.projectId,runId:scope.runId});
 const append=async(scope,text='实际新增输入',extra={})=>{const view=await workspace(scope);return call(`/runs/${scope.runId}/messages`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID(),'if-match':`"r${view.run.resourceRevision}"`,...extra.headers},body:JSON.stringify({text,attachmentIds:[],clientMessageId:randomUUID(),intentHint:'unsure'})});};
 const sql=(query,...args)=>{const db=new DatabaseSync(join(f.options.dataRoot,'db/devmesh.sqlite'));try{db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');return db.prepare(query).all(...args);}finally{db.close();}};
 const url=(scope,afterSeq=0)=>f.origin.replace(/^http/,'ws')+'/events?'+new URLSearchParams({principalId:'user_1',projectId:scope.projectId,runId:scope.runId,afterSeq:String(afterSeq)});
 const open=(scope,afterSeq=0,extra={})=>{
  const socket=new WebSocket(extra.url??url(scope,afterSeq),{headers:{authorization:'Bearer events-owner',origin:f.origin,...extra.headers}});peers.add(socket);
  const frames=[],errors=[],waiters=new Set();let closed;
  const notify=()=>{for(const waiter of waiters)waiter();};
  socket.on('message',bytes=>{try{frames.push(workbenchEventFrame.parse(JSON.parse(bytes.toString())));}catch(error){errors.push(error);}notify();});
  socket.on('error',error=>{errors.push(error);notify();});
  socket.on('close',(code,reason)=>{closed={code,reason:reason.toString()};peers.delete(socket);notify();});
  const wait=(predicate,description)=>new Promise((resolve,reject)=>{const check=()=>{let value;try{assert.equal(errors.length,0,errors.map(e=>e.message).join('; '));value=predicate();}catch(error){clearTimeout(timer);waiters.delete(check);reject(error);return;}if(value){clearTimeout(timer);waiters.delete(check);resolve(value);}};const timer=setTimeout(()=>{waiters.delete(check);reject(new Error('Timed out: '+description+'; frames='+JSON.stringify(frames)+'; closed='+JSON.stringify(closed)));},deadline);waiters.add(check);check();});
  return {socket,frames,wait,frame:(kind,predicate=()=>true)=>wait(()=>frames.find(frame=>frame.kind===kind&&predicate(frame)),kind),closed:()=>wait(()=>closed,'socket close')};
 };
 const refusal=(scope,{afterSeq=0,headers={},target}={})=>new Promise((resolve,reject)=>{const values=Object.fromEntries(Object.entries({authorization:'Bearer events-owner',origin:f.origin,...headers}).filter(([,v])=>v!==undefined)),socket=new WebSocket(target??url(scope,afterSeq),{headers:values});peers.add(socket);const timer=setTimeout(()=>{socket.terminate();reject(new Error('Upgrade refusal timed out'));},deadline);socket.on('error',()=>{});socket.once('unexpected-response',(_req,response)=>{clearTimeout(timer);response.resume();socket.terminate();peers.delete(socket);resolve(response.statusCode);});socket.once('open',()=>{clearTimeout(timer);socket.terminate();reject(new Error('Unexpected accepted upgrade'));});});
 const gateWindow=()=>{const reached=Promise.withResolvers(),release=Promise.withResolvers(),original=f.storage.request.bind(f.storage);let held=false;f.storage.request=async(method,args)=>{const result=await original(method,args);if(method==='getInputEventWindow'&&!held){held=true;reached.resolve(result);await release.promise;}return result;};const restore=()=>{release.resolve();f.storage.request=original;};t.after(restore);return {reached:reached.promise,release:()=>release.resolve(),restore};};
 return Object.assign(f,{state,config,reopen,call,create,workspace,append,sql,url,open,refusal,gateWindow});
}
