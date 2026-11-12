import {performance} from 'node:perf_hooks';

export interface PreviewClockSource {wall:()=>number;monotonic:()=>number}
/** One Worker lifetime. Persisted high-water and expiry latches survive it. */
export class PreviewClock {
  readonly #source:PreviewClockSource;readonly #deadlines=new Map<string,{deadline:number;expired:boolean}>();
 constructor(source:PreviewClockSource={wall:Date.now,monotonic:()=>performance.now()}){this.#source=source;}
 forget(id:string){this.#deadlines.delete(id);}
 observe(id:string,expiresAt:string,lastWallAt:string,latched:boolean){
  const wall=this.#source.wall(),monotonic=this.#source.monotonic(),last=Date.parse(lastWallAt),expiry=Date.parse(expiresAt);
   let current=this.#deadlines.get(id);if(current===undefined){current={deadline:monotonic+Math.max(0,expiry-Math.max(wall,last)),expired:false};this.#deadlines.set(id,current);}
   // A surrounding SQLite rollback cannot undo an observation in this Worker.
   current.expired ||= latched||wall<last||wall>=expiry||monotonic>=current.deadline;
   return {expired:current.expired,wallAt:new Date(Math.max(wall,last)).toISOString()};
 }
}
