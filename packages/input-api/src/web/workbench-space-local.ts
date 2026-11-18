import type {z} from 'zod';
import type {workbenchSpaceOperation} from '@devmesh/contracts';
type Action=z.output<typeof workbenchSpaceOperation>;
export type SpaceOriginal=Action&{key:string;owner:string;scope:string;state:'PENDING'|'SUCCEEDED'|'FAILED'};
export async function openSpaceLocal(owner:string){
 const req=indexedDB.open('devmesh.workbench-spaces',1);req.onupgradeneeded=()=>req.result.createObjectStore('commands',{keyPath:'key'});
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 function run<T>(mode:IDBTransactionMode,work:(s:IDBObjectStore)=>IDBRequest<T>){return new Promise<T>((resolve,reject)=>{const tx=db.transaction('commands',mode),r=work(tx.objectStore('commands'));tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error??Error('LOCAL_SAVE_FAILED'));tx.onerror=()=>{};});}
 async function pending(){return (await run('readonly',s=>s.getAll()) as SpaceOriginal[]).find(c=>c.owner===owner&&c.state==='PENDING')??null;}
 async function begin(action:Action){const c:SpaceOriginal={...action,key:crypto.randomUUID(),owner,scope:action.kind==='CREATE'?'workbench-spaces.create':action.kind==='MOVE'?action.conversationId:action.spaceId,state:'PENDING'};return new Promise<SpaceOriginal>((resolve,reject)=>{const tx=db.transaction('commands','readwrite'),s=tx.objectStore('commands'),r=s.getAll();let failure:unknown;r.onsuccess=()=>{try{if((r.result as SpaceOriginal[]).some(v=>v.owner===owner&&v.state==='PENDING')){tx.abort();return;}s.add(c);}catch(e){failure=e;try{tx.abort();}catch{/* Already aborted. */}}};tx.oncomplete=()=>resolve(c);tx.onabort=()=>reject(failure??tx.error??Error('LOCAL_PENDING'));tx.onerror=()=>{};});}
 async function finish(c:SpaceOriginal,state:'SUCCEEDED'|'FAILED'){await run('readwrite',s=>s.put({...c,state}));}
 return {pending,begin,finish,close:()=>db.close()};
}
