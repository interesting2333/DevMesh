import {z} from 'zod';
import {domainEvent,workbenchEventFrame,workbenchEventSubscription,workspaceView} from '@devmesh/contracts';
import type {DomainEvent,WorkbenchEventSubscription,ModelProgressFrame} from '@devmesh/contracts';
import {WorkbenchApiError} from './workbench-api.js';

type Snapshot=z.output<typeof workspaceView>;
export interface WorkbenchLiveState {
 status:'connecting'|'live'|'syncing'|'offline'|'stopped';cursor:number;unread:number;events:DomainEvent[];
 streams:WorkbenchLiveStream[];
}
export interface WorkbenchLiveStream {streamId:string;role:ModelProgressFrame['role'];index:number;text:string;state:'streaming'|'persisted'|'interrupted'}
interface Options {
 scope:WorkbenchEventSubscription;
 read:(path:string,signal:AbortSignal)=>Promise<unknown>;
 onState:(state:WorkbenchLiveState)=>void;
 onSnapshot:(snapshot:Snapshot)=>void;
 onAuthorizationLost:()=>void;
}
const history=z.strictObject({events:z.array(domainEvent).max(200),nextCursor:z.number().int().safe().nonnegative()});
const maximumBufferedBytes=512*1024,maximumBufferedEvents=200,maximumGapEvents=2000,maximumResnapshots=5,resnapshotWindowMs=30000;

/** A read-only observer. It never opens a local journal or sends a business command. */
export function observeWorkbenchEvents(options:Options){
 const scope=workbenchEventSubscription.parse(options.scope),base='/api/v1/projects/'+encodeURIComponent(scope.projectId),encoder=new TextEncoder();
 let cursor=scope.afterSeq,displayed=cursor,status:WorkbenchLiveState['status']='connecting',disposed=false,epoch=0,failures=0,bufferedBytes=0,target=cursor;
 let peer:WebSocket|undefined,reading:AbortController|undefined,retry:ReturnType<typeof setTimeout>|undefined,handshake:ReturnType<typeof setTimeout>|undefined,notification:ReturnType<typeof setTimeout>|undefined,gapRunning=false;
 let recent:DomainEvent[]=[],resnapshotTimes:number[]=[],streams:WorkbenchLiveStream[]=[];
 const lastProgress=new Map<string,string>();
 const buffer=new Map<number,{event:DomainEvent;bytes:number}>();
 function emit(){if(disposed||notification)return;notification=setTimeout(()=>{notification=undefined;if(!disposed)options.onState({status,cursor,unread:Math.max(0,cursor-displayed),events:[...recent],streams:streams.map(stream=>({...stream}))});},16);}
 function teardown(){epoch++;clearTimeout(retry);clearTimeout(handshake);retry=undefined;handshake=undefined;reading?.abort();reading=undefined;gapRunning=false;const old=peer;peer=undefined;old?.close();buffer.clear();bufferedBytes=0;streams=streams.map(stream=>stream.state==='streaming'?{...stream,state:'interrupted'}:stream);}
 function stop(){if(disposed)return;disposed=true;teardown();clearTimeout(notification);notification=undefined;window.removeEventListener('online',online);}
 function denied(error:unknown){return error instanceof WorkbenchApiError&&[401,403,404].includes(error.status);}
 function loseAuthorization(){stop();options.onAuthorizationLost();}
 function sameContext(event:DomainEvent){if(event.projectId!==scope.projectId||event.runId!==scope.runId)throw Error('Foreign event context');}
 function acceptProgress(frame:ModelProgressFrame){
  let current=streams.find(stream=>stream.streamId===frame.streamId);const original=JSON.stringify(frame);
  if(current&&frame.index===current.index){if(lastProgress.get(frame.streamId)!==original)current.state='interrupted';emit();return;}
  if(current&&frame.index<current.index)return;
  if(!current){
   const started=frame.kind==='token-stream'&&frame.state==='started'&&frame.index===0;
   current={streamId:frame.streamId,role:frame.role,index:frame.index,text:'',state:started?'streaming':'interrupted'};
   streams=[...streams,current].slice(-4);for(const key of lastProgress.keys())if(!streams.some(stream=>stream.streamId===key))lastProgress.delete(key);
   lastProgress.set(frame.streamId,original);emit();return;
  }
  if(current.role!==frame.role||current.state!=='streaming'||frame.index!==current.index+1){current.state='interrupted';emit();return;}
  current.index=frame.index;lastProgress.set(frame.streamId,original);
  if(frame.kind==='token-delta'){
   if(encoder.encode(current.text).byteLength+encoder.encode(frame.text).byteLength>65536)current.state='interrupted';else current.text+=frame.text;
  }else if(frame.state==='started')current.state='interrupted';else current.state=frame.state;
  emit();
 }
 function apply(event:DomainEvent){
  sameContext(event);if(event.seq!==cursor+1)throw Error('Nonconsecutive event');
  cursor=event.seq;recent=[...recent,event].slice(-100);emit();
 }
 function drain(){for(;;){const item=buffer.get(cursor+1);if(!item)break;buffer.delete(item.event.seq);bufferedBytes-=item.bytes;apply(item.event);}}
 function accept(event:DomainEvent){
  sameContext(event);
  if(event.seq<=cursor){const known=recent.find(item=>item.seq===event.seq);if(known&&JSON.stringify(known)!==JSON.stringify(event))throw Error('Conflicting duplicate event');return;}
  const known=buffer.get(event.seq);if(known){if(JSON.stringify(known.event)!==JSON.stringify(event))throw Error('Conflicting buffered event');return;}
  if(recent.some(item=>item.eventId===event.eventId&&item.seq!==event.seq))throw Error('Repeated event identity');
  target=Math.max(target,event.seq);
  if(event.seq===cursor+1){apply(event);drain();return;}
  const bytes=encoder.encode(JSON.stringify(event)).byteLength;
  if(buffer.size>=maximumBufferedEvents||bufferedBytes+bytes>maximumBufferedBytes)throw Error('Event buffer exceeded');
  buffer.set(event.seq,{event,bytes});bufferedBytes+=bytes;
 }
 function reconnect(){
  if(disposed)return;teardown();status='offline';failures++;emit();
  if(failures<=5)retry=setTimeout(()=>void resnapshot(),Math.min(250*2**(failures-1),4000));
 }
 async function resnapshot(){
  if(disposed)return;teardown();const now=Date.now();resnapshotTimes=resnapshotTimes.filter(time=>now-time<resnapshotWindowMs);
  if(resnapshotTimes.length>=maximumResnapshots){status='offline';emit();return;}
  resnapshotTimes.push(now);const token=epoch,controller=new AbortController();reading=controller;status='syncing';emit();
  try{
   const snapshot=workspaceView.parse(await options.read(base+'/workspace?runId='+encodeURIComponent(scope.runId)+'&limit=1',controller.signal));
   if(disposed||token!==epoch)return;
   if(snapshot.project.projectId!==scope.projectId||snapshot.run.runId!==scope.runId||snapshot.run.eventSeq!==snapshot.eventCursor||snapshot.eventCursor<cursor)throw Error('Invalid replacement snapshot');
   cursor=snapshot.eventCursor;target=cursor;recent=[];options.onSnapshot(snapshot);reading=undefined;connect();
  }catch(error){if(disposed||token!==epoch)return;if(denied(error))loseAuthorization();else reconnect();}
 }
 async function fillGap(){
  if(disposed||gapRunning||target<=cursor)return;gapRunning=true;const token=epoch,controller=new AbortController();reading=controller;status='syncing';emit();let count=0;
  try{
   while(target>cursor){
    const after=cursor,page=history.parse(await options.read(base+'/runs/'+encodeURIComponent(scope.runId)+'/events?afterSeq='+cursor+'&limit=200',controller.signal));
    if(disposed||token!==epoch)return;
    if(!page.events.length||page.events[0]!.seq!==after+1||page.nextCursor!==page.events.at(-1)!.seq)throw Error('Missing event history');
    let expected=after+1;for(const event of page.events){sameContext(event);if(event.seq!==expected++||++count>maximumGapEvents)throw Error('History sequence or budget exceeded');accept(event);}
    if(cursor<page.nextCursor)throw Error('Incomplete history merge');
   }
   if(token===epoch){status='live';emit();}
  }catch(error){if(disposed||token!==epoch)return;if(denied(error))loseAuthorization();else void resnapshot();}
  finally{if(token===epoch){gapRunning=false;if(reading===controller)reading=undefined;}}
 }
 function connect(){
  if(disposed)return;const token=epoch,afterSeq=cursor,url=new URL('/events',location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
  url.search=new URLSearchParams({principalId:scope.principalId,projectId:scope.projectId,runId:scope.runId,afterSeq:String(afterSeq)}).toString();
  status='connecting';emit();let subscribed=false;
  let socket:WebSocket;try{socket=new WebSocket(url);peer=socket;}catch{reconnect();return;}
  handshake=setTimeout(()=>{if(token===epoch&&!disposed)reconnect();},16000);
  socket.addEventListener('message',message=>{
   if(disposed||token!==epoch||peer!==socket)return;
   try{
    if(typeof message.data!=='string'||encoder.encode(message.data).byteLength>maximumBufferedBytes)throw Error('Invalid event frame size');
    const frame=workbenchEventFrame.parse(JSON.parse(message.data));
    if(frame.projectId!==scope.projectId||frame.runId!==scope.runId)throw Error('Foreign event frame');
    if(frame.kind==='subscribed'){if(subscribed||frame.afterSeq!==afterSeq)throw Error('Subscription cursor differs');subscribed=true;clearTimeout(handshake);handshake=undefined;return;}
    if(!subscribed)throw Error('Frame preceded subscription');
    if(frame.kind==='authorization-lost'){loseAuthorization();return;}
    if(frame.kind==='resync-required'){void resnapshot();return;}
    if(frame.kind==='service-stopping'){reconnect();return;}
    if(frame.kind==='token-delta'||frame.kind==='token-stream'){acceptProgress(frame);return;}
    if(frame.kind==='domain-event'){accept(frame.event);if(target>cursor)void fillGap();return;}
    target=Math.max(target,frame.throughSeq);if(target>cursor)void fillGap();else{failures=0;status='live';emit();}
   }catch{void resnapshot();}
  });
  socket.addEventListener('close',()=>{if(!disposed&&token===epoch&&peer===socket)reconnect();});
  socket.addEventListener('error',()=>{if(!disposed&&token===epoch&&peer===socket)reconnect();});
 }
 function acknowledge(afterSeq:number){
  if(disposed||!Number.isSafeInteger(afterSeq)||afterSeq<displayed)throw Error('Invalid displayed snapshot cursor');
  displayed=afterSeq;
  if(afterSeq>cursor){teardown();cursor=afterSeq;target=cursor;recent=[];connect();}else emit();
 }
 function retryConnection(){if(!disposed){failures=0;resnapshotTimes=[];void resnapshot();}}
 function online(){if(!disposed&&status==='offline')retryConnection();}
 window.addEventListener('online',online);connect();
 return {stop,acknowledge,retry:retryConnection};
}
