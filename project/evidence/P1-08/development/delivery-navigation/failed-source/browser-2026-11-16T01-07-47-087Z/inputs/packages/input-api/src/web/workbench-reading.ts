import {z} from 'zod';
import {ids,opaqueKey,epoch,timestamp} from '@devmesh/contracts';

const scope=z.strictObject({principalId:opaqueKey,projectId:ids.project,runId:ids.run});
export const workbenchReading=scope.extend({schemaVersion:z.literal(1),tab:z.enum(['任务','协作','成果','预览','记录']),panel:z.enum(['sidebar','conversation','detail']),candidateId:ids.candidate.nullable(),candidateAfterRevision:epoch,updatedAt:timestamp});
export type WorkbenchReading=z.output<typeof workbenchReading>;
type Scope=z.input<typeof scope>;
const prefix='devmesh.workbench.reading.v1:';
const returnKey='devmesh.workbench.return.v1';
export const workbenchReturnBoot=z.strictObject({principalId:opaqueKey,projectId:ids.project,targetRunId:ids.run});
const launch=workbenchReturnBoot.extend({schemaVersion:z.literal(1),sourceRunId:ids.run,createdAt:timestamp});
export function saveWorkbenchReturn(input:z.input<typeof launch>):void{
 const value=launch.parse(input);sessionStorage.setItem(returnKey,JSON.stringify(value));
}
export function workbenchReturnTarget(input:z.input<typeof workbenchReturnBoot>):string|null{
 try{
  const boot=workbenchReturnBoot.parse(input),raw=sessionStorage.getItem(returnKey);if(raw===null||raw.length>2048)return null;
  const value=launch.parse(JSON.parse(raw)),age=Date.now()-Date.parse(value.createdAt);
  if(value.principalId!==boot.principalId||value.projectId!==boot.projectId||value.targetRunId!==boot.targetRunId||age<0||age>8*60*60*1000)return null;
  return '/api/v1/workbench/view?'+new URLSearchParams({projectId:boot.projectId,runId:value.sourceRunId});
 }catch{return null;}
}
const key=(value:Scope)=>{const s=scope.parse({principalId:value.principalId,projectId:value.projectId,runId:value.runId});return prefix+JSON.stringify([s.principalId,s.projectId,s.runId]);};
export function readWorkbenchReading(value:Scope):{state:WorkbenchReading|null;unavailable:boolean}{
 try{
  const raw=sessionStorage.getItem(key(value));if(raw===null)return {state:null,unavailable:false};
  if(raw.length>4096)throw Error('Reading state too large');
  const state=workbenchReading.parse(JSON.parse(raw));
  if(key(state)!==key(value))throw Error('Wrong reading context');
  return {state,unavailable:false};
 }catch{return {state:null,unavailable:true};}
}
/** UI preferences only; no command, draft identity, or authorization is stored. */
export function saveWorkbenchReading(input:z.input<typeof workbenchReading>):void{
 const state=workbenchReading.parse(input),target=key(state),raw=JSON.stringify(state);
 if(raw.length>4096)throw Error('Reading state too large');
 sessionStorage.setItem(target,raw);
 // Keep at most 50 reading positions, without touching any other namespace.
 const positions:{key:string;at:string}[]=[];
 for(let index=0;index<sessionStorage.length;index++){
  const name=sessionStorage.key(index);if(!name?.startsWith(prefix)||name===target)continue;
  let at='';try{const value=sessionStorage.getItem(name);if(value&&value.length<=4096)at=workbenchReading.parse(JSON.parse(value)).updatedAt;}catch{/* Invalid UI preferences may be evicted after the new state is saved. */}
  positions.push({key:name,at});
 }
 positions.sort((a,b)=>a.at.localeCompare(b.at)||a.key.localeCompare(b.key));
 for(const old of positions.slice(0,Math.max(0,positions.length-49)))sessionStorage.removeItem(old.key);
}
