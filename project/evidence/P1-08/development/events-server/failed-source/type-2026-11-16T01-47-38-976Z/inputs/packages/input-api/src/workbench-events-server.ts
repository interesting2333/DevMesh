import type {IncomingMessage,Server} from 'node:http';
import type {Duplex} from 'node:stream';
import {z} from 'zod';
import {WebSocketServer,WebSocket} from 'ws';
import {StorageError} from '@devmesh/storage-sqlite';
import {workbenchEventSubscription,workbenchEventFrame,domainEvent} from '@devmesh/contracts';
import type {WorkbenchEventSubscription,WorkbenchEventFrame} from '@devmesh/contracts';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {createInputAuthenticator} from './input-auth.js';

const integer=(min:number,max:number)=>z.number().int().min(min).max(max);
const limitsSchema=z.strictObject({
 maximumConnections:integer(1,256).default(64),maximumPendingUpgrades:integer(1,64).default(16),
 maximumPendingWakeups:integer(1,4096).default(256),pageSize:integer(1,200).default(50),
 maximumCatchupEvents:integer(1,10000).default(2000),maximumOutboundBytes:integer(1024,4*1024*1024).default(256*1024),
 sendTimeoutMs:integer(50,10000).default(5000),reauthorizeMs:integer(50,30000).default(10000),closeTimeoutMs:integer(25,1000).default(250),
});
export type WorkbenchEventLimits=z.input<typeof limitsSchema>;
type Authenticator=ReturnType<typeof createInputAuthenticator>;
type ResyncReason=Extract<WorkbenchEventFrame,{kind:'resync-required'}>['reason'];
const decimal=z.string().regex(/^(0|[1-9][0-9]{0,15})$/).transform(Number).pipe(z.number().int().safe().nonnegative());
const querySchema=z.strictObject({principalId:z.string(),projectId:z.string(),runId:z.string(),afterSeq:decimal});
const windowSchema=z.strictObject({events:z.array(domainEvent).max(200),nextCursor:z.number().int().safe().nonnegative(),headSeq:z.number().int().safe().nonnegative(),retainedFromSeq:z.number().int().safe().positive()});

export function createWorkbenchEventServer(content:LocalContentStore,auth:Authenticator,input:WorkbenchEventLimits={}){
 const limits=limitsSchema.parse(input),wss=new WebSocketServer({noServer:true,clientTracking:true,maxPayload:4096,perMessageDeflate:false});
 const pending=new Map<Promise<void>,AbortController>(),clients=new Set<{stop:()=>void;done:Promise<void>}>();
 let server:Server|undefined,accepting=true,stopping:Promise<void>|undefined;
 wss.on('error',()=>{/* A per-socket error closes that connection, never changes domain facts. */});
 function refuse(socket:Duplex,status:number){if(socket.destroyed)return;socket.end('HTTP/1.1 '+status+' Request rejected\r\nConnection: close\r\nContent-Length: 0\r\nCache-Control: no-store\r\n\r\n');}
 function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
  if(signal.aborted)return Promise.reject(signal.reason);
  return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});
 }
 function connected(socket:WebSocket,request:IncomingMessage,scope:WorkbenchEventSubscription){
  let cursor=scope.afterSeq,wakeups=0,dirty=true,pumping=false,closed=false,caughtUp=false,initialCount=0,awaitingPong=false;
  const controller=new AbortController(),context={schemaVersion:1 as const,projectId:scope.projectId,runId:scope.runId},finished=Promise.withResolvers<void>();
  let active:Promise<void>|undefined,timer:ReturnType<typeof setInterval>|undefined,unsubscribe=()=>{};
  const record={stop:()=>close({kind:'service-stopping',...context},1001),done:finished.promise};clients.add(record);
  let force:ReturnType<typeof setTimeout>|undefined;
  function close(frame:WorkbenchEventFrame,code=1013){
   if(closed)return;closed=true;unsubscribe();clearInterval(timer);controller.abort(new Error('Event subscription closed'));
   if(socket.readyState===WebSocket.OPEN){const text=JSON.stringify(workbenchEventFrame.parse(frame));if(socket.bufferedAmount+Buffer.byteLength(text)<=limits.maximumOutboundBytes)socket.send(text,()=>{});socket.close(code,frame.kind);}
   else if(socket.readyState!==WebSocket.CLOSED)socket.terminate();
   force=setTimeout(()=>socket.terminate(),limits.closeTimeoutMs);force.unref();
  }
  const resync=(reason:ResyncReason)=>close({...context,kind:'resync-required',afterSeq:cursor,reason});
  async function authorize(){
   await auth.authenticate(request,{upgrade:true,expectedPrincipalId:scope.principalId,signal:controller.signal});
   await abortable(content.storage.request('checkInputAccess',{principalId:scope.principalId,runId:scope.runId}).then(access=>{if(access.projectId!==scope.projectId)throw new StorageError('RESOURCE_NOT_FOUND',404,'Run is not visible');}),controller.signal);
  }
  function send(frame:WorkbenchEventFrame):Promise<void>{
   if(closed||socket.readyState!==WebSocket.OPEN)return Promise.reject(new Error('Event socket is not open'));
   const text=JSON.stringify(workbenchEventFrame.parse(frame));
   if(socket.bufferedAmount+Buffer.byteLength(text)>limits.maximumOutboundBytes){resync('SLOW_CLIENT');return Promise.reject(new Error('Event send budget exceeded'));}
   return new Promise((resolve,reject)=>{
    let settled=false;const complete=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timeout);controller.signal.removeEventListener('abort',abort);if(error)reject(error);else resolve();};
    const abort=()=>complete(new Error('Event send cancelled'));
    const timeout=setTimeout(()=>{resync('SLOW_CLIENT');complete(new Error('Event send deadline exceeded'));},limits.sendTimeoutMs);timeout.unref();controller.signal.addEventListener('abort',abort,{once:true});
    try{socket.send(text,error=>complete(error));}catch(error){complete(error as Error);}
   });
  }
  async function pump(){
   if(pumping||closed)return;pumping=true;
   try{
    do{
     dirty=false;wakeups=0;await authorize();if(closed)return;
     const page=windowSchema.parse(await abortable(content.storage.request('getInputEventWindow',{principalId:scope.principalId,projectId:scope.projectId,runId:scope.runId,afterSeq:cursor,limit:limits.pageSize}),controller.signal));
     if(cursor>page.headSeq){resync('CURSOR_AHEAD');return;}
     if(cursor<page.headSeq&&cursor+1<page.retainedFromSeq){resync('RETAINED_GAP');return;}
     // Reauthorize after asynchronous replay reads, before exposing their facts.
     await authorize();if(closed)return;
     if(page.events.length===0&&cursor!==page.headSeq){resync('RETAINED_GAP');return;}
     for(const event of page.events){
      if(event.projectId!==scope.projectId||event.runId!==scope.runId||event.seq!==cursor+1){resync('RETAINED_GAP');return;}
      if(!caughtUp&&++initialCount>limits.maximumCatchupEvents){resync('CATCHUP_LIMIT');return;}
      await send({...context,kind:'domain-event',event});cursor=event.seq;
     }
     if(cursor!==page.nextCursor){resync('RETAINED_GAP');return;}
     if(cursor<page.headSeq){dirty=true;continue;}
     caughtUp=true;await send({...context,kind:'caught-up',throughSeq:cursor});
    }while(dirty&&!closed);
   }catch(error){
    if(closed)return;
    if(error instanceof StorageError&&[401,403,404].includes(error.status))close({...context,kind:'authorization-lost'},1008);
    else if(error instanceof StorageError&&error.code==='EVENT_CURSOR_INVALID')resync('CURSOR_AHEAD');
    else resync('STORAGE_UNAVAILABLE');
   }finally{pumping=false;}
  }
  function wake(){
   if(closed)return;dirty=true;if(++wakeups>limits.maximumPendingWakeups){resync('BUFFER_OVERFLOW');return;}
   if(!pumping){active=pump();void active;}
  }
  socket.on('pong',()=>{awaitingPong=false;});socket.on('error',()=>resync('SLOW_CLIENT'));
  socket.on('message',()=>close({...context,kind:'resync-required',afterSeq:cursor,reason:'PROTOCOL_INVALID'},1008));
  socket.once('close',()=>{closed=true;unsubscribe();clearInterval(timer);if(force)clearTimeout(force);controller.abort(new Error('Event socket disconnected'));void Promise.resolve(active).finally(()=>{clients.delete(record);finished.resolve();});});
  // Subscribe first. The buffer holds bounded commit invalidations, not unprotected payloads.
  try{unsubscribe=content.storage.subscribeEventCommits(wake);}catch{resync('STORAGE_UNAVAILABLE');return;}
  timer=setInterval(()=>{if(closed)return;if(awaitingPong||socket.readyState!==WebSocket.OPEN){resync('SLOW_CLIENT');return;}awaitingPong=true;try{socket.ping();wake();}catch{resync('SLOW_CLIENT');}},limits.reauthorizeMs);timer.unref();
  active=(async()=>{try{await send({...context,kind:'subscribed',afterSeq:cursor});await pump();}catch{if(!closed)resync('STORAGE_UNAVAILABLE');}})();
 }
 const upgrade=(request:IncomingMessage,socket:Duplex,head:Buffer)=>{
  if(!accepting){refuse(socket,503);return;}
  if(pending.size>=limits.maximumPendingUpgrades||clients.size>=limits.maximumConnections){refuse(socket,503);return;}
  const controller=new AbortController();
  const work=(async()=>{try{
   if(request.method!=='GET'||head.length>16384||!request.url?.startsWith('/')||request.url.startsWith('//')||request.url.length>2048)throw new StorageError('SCHEMA_INVALID',422,'Invalid event upgrade');
   const url=new URL(request.url??'','http://127.0.0.1');if(url.pathname!=='/events')throw new StorageError('RESOURCE_NOT_FOUND',404,'Upgrade route not found');
   const pairs=[...url.searchParams];if(new Set(pairs.map(([key])=>key)).size!==pairs.length)throw new StorageError('SCHEMA_INVALID',422,'Repeated subscription parameter');
   const q=querySchema.parse(Object.fromEntries(pairs)),scope=workbenchEventSubscription.parse({...q,schemaVersion:1});
   if(request.headers['sec-websocket-protocol']!==undefined)throw new StorageError('SCHEMA_INVALID',422,'Unexpected WebSocket subprotocol');
   await auth.authenticate(request,{upgrade:true,expectedPrincipalId:scope.principalId,signal:controller.signal});
   const access=await abortable(content.storage.request('checkInputAccess',{principalId:scope.principalId,runId:scope.runId}),controller.signal);
   if(access.projectId!==scope.projectId)throw new StorageError('RESOURCE_NOT_FOUND',404,'Run is not visible');
   if(!accepting||controller.signal.aborted||clients.size>=limits.maximumConnections){refuse(socket,503);return;}
   wss.handleUpgrade(request,socket,head,ws=>connected(ws,request,scope));
  }catch(error){refuse(socket,error instanceof StorageError?error.status:422);}})();
  pending.set(work,controller);void work.finally(()=>pending.delete(work));
 };
 return {
  attach(host:Server){if(server||!accepting)throw new Error('Event server can only attach once before stopping');server=host;host.on('upgrade',upgrade);},
  stopAdmission(){accepting=false;},
  stop(){stopping??=(async()=>{accepting=false;server?.off('upgrade',upgrade);for(const controller of pending.values())controller.abort(new Error('Event server stopping'));for(const client of clients)client.stop();await Promise.allSettled([...pending.keys(),...[...clients].map(client=>client.done)]);await new Promise<void>(resolve=>wss.close(()=>resolve()));})();return stopping;},
 };
}
