import {assistantLiveFrame,opaqueKey,parseContract} from '@devmesh/contracts';
import type {AssistantLiveFrame,AssistantLiveUpdate} from '@devmesh/contracts';
import type {Router,Request,Response,RequestHandler} from 'express';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Identity} from './index.js';
import {StorageError} from '@devmesh/storage-sqlite';
type Route=(h:(r:Request,s:Response,i:Identity)=>Promise<void>)=>RequestHandler;
export function mountConversationLive(router:Router,content:LocalContentStore,route:Route,auth:{authenticate:(request:Request)=>Promise<Identity>}){
 let seq=0,accepting=true;const latest=new Map<string,{principal:string;frame:AssistantLiveFrame}>(),issued=new Map<string,number>(),clients=new Set<{id:string;principal:string;res:Response;close:()=>void}>();
 const send=(res:Response,frame:AssistantLiveFrame)=>{if(res.destroyed||res.writableLength>262144){res.end();return;}res.write('id: '+frame.seq+'\nevent: progress\ndata: '+JSON.stringify(frame)+'\n\n');};
 function publish(update:AssistantLiveUpdate){if(!accepting)return;const ticket=++seq;issued.set(update.conversationId,ticket);void content.storage.request('getConversation',{principalId:update.principalId,conversationId:update.conversationId,limit:1}).then(view=>{if(!accepting||issued.get(update.conversationId)!==ticket||view.conversation.inputRevision!==update.inputRevision)return;const {principalId,...data}=update,frame=assistantLiveFrame.parse({...data,seq:ticket});latest.set(frame.conversationId,{principal:principalId,frame});if(latest.size>200){const oldest=latest.keys().next().value;if(oldest)latest.delete(oldest);}for(const client of clients)if(client.id===frame.conversationId&&client.principal===principalId)send(client.res,frame);}).catch(()=>{});}
 router.get('/conversations/:conversationId/live',route(async(req,res,identity)=>{
  const id=parseContract(opaqueKey,req.params.conversationId),view=await content.storage.request('getConversation',{principalId:identity.principalId,conversationId:id,limit:1});
  if([...clients].filter(c=>c.principal===identity.principalId).length>=8)throw new StorageError('LIMIT_EXCEEDED',429,'Too many live conversation connections');
  res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();res.write(': connected\n\n');
  const cached=latest.get(id);if(cached?.principal===identity.principalId&&cached.frame.inputRevision===view.conversation.inputRevision)send(res,cached.frame);
  let checking=false,closed=false;const client={id,principal:identity.principalId,res,close:()=>{if(closed)return;closed=true;clearInterval(timer);clients.delete(client);if(!res.destroyed)res.end();}};
  const timer=setInterval(()=>{if(checking)return;checking=true;void auth.authenticate(req).then(fresh=>{if(fresh.principalId!==identity.principalId)throw new StorageError('FORBIDDEN',403,'Identity changed');return content.storage.request('getConversation',{principalId:identity.principalId,conversationId:id,limit:1});}).then(current=>{if(current.conversation.inputRevision!==view.conversation.inputRevision){res.write('event: reset\ndata: {}\n\n');client.close();}else if(!res.destroyed)res.write(': heartbeat\n\n');}).catch(()=>client.close()).finally(()=>{checking=false;});},2000);timer.unref();clients.add(client);res.once('close',client.close);
 }));
 return {publish,stop(){accepting=false;for(const c of clients)c.close();latest.clear();issued.clear();}};
}
