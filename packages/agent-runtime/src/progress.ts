import {randomUUID} from 'node:crypto';
import {modelProgressFrame} from '@devmesh/contracts';
import type {ModelProgressFrame} from '@devmesh/contracts';
import type {SqliteStorage} from '@devmesh/storage-sqlite';
export type ModelProgressSink=(frame:ModelProgressFrame)=>void;

/** Transient display only. Persistence and tool admission remain the caller's responsibility. */
export async function beginModelProgress(storage:SqliteStorage,principalId:string,runId:string,role:ModelProgressFrame['role'],sink?:ModelProgressSink){
 let send:ModelProgressSink|undefined,projectId='';
 if(sink){try{projectId=(await storage.request('checkInputAccess',{principalId,runId})).projectId;send=sink;}catch{/* No authorized display context; the execution's original admission remains authoritative. */}}
 const base={schemaVersion:1 as const,projectId,runId,role,streamId:'stream_'+randomUUID()};let index=0,ended=false;
 function publish(frame:unknown){try{send?.(modelProgressFrame.parse(frame));}catch{/* A display sink never changes execution or persistence outcomes. */}}
 if(send)publish({...base,kind:'token-stream',index:0,state:'started'});
 return {
  delta(text:string){
   if(!send||ended)return;
   for(let at=0;at<text.length;){let end=Math.min(at+2048,text.length);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]!))end--;publish({...base,kind:'token-delta',index:++index,text:text.slice(at,end)});at=end;}
  },
  persisted(){if(!ended){ended=true;if(send)publish({...base,kind:'token-stream',index:++index,state:'persisted'});}},
  interrupted(){if(!ended){ended=true;if(send)publish({...base,kind:'token-stream',index:++index,state:'interrupted'});}},
 };
}
