import {z} from 'zod';
import {ids,opaqueKey,epoch} from '@devmesh/contracts';

// Keep the original tab values stable; only the visible Task label changes.
export const conversationDetailTabs=['任务','协作','成果','预览','记录'] as const;
export type ConversationDetailTab=(typeof conversationDetailTabs)[number];
const reading=z.strictObject({tab:z.enum(conversationDetailTabs),candidateId:ids.candidate.nullable(),candidateAfterRevision:epoch,positions:z.record(z.enum(conversationDetailTabs),z.number().min(0).max(10000000)),updatedAt:z.number().finite()});
export type DetailReading=z.output<typeof reading>;
const prefix='devmesh.conversation.details.v1:';
export function detailReadingKey(principalId:string,conversationId:string,runId:string|null){
 return prefix+JSON.stringify([opaqueKey.parse(principalId),opaqueKey.parse(conversationId),runId===null?null:ids.run.parse(runId)]);
}
export function readDetailReading(key:string):DetailReading|null{
 try{const raw=sessionStorage.getItem(key);return raw&&raw.length<=4096?reading.parse(JSON.parse(raw)):null;}catch{return null;}
}
export function saveDetailReading(key:string,value:z.input<typeof reading>){
 sessionStorage.setItem(key,JSON.stringify(reading.parse(value)));
 const old:{key:string;at:number}[]=[];
 for(let index=0;index<sessionStorage.length;index++){const name=sessionStorage.key(index);if(name?.startsWith(prefix)&&name!==key)old.push({key:name,at:readDetailReading(name)?.updatedAt??0});}
 old.sort((a,b)=>a.at-b.at);
 for(const item of old.slice(0,Math.max(0,old.length-49)))sessionStorage.removeItem(item.key);
}
