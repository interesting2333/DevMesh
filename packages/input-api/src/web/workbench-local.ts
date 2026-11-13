import {z} from 'zod';
import {ids,opaqueKey,revision,timestamp,createProjectInput,saveMessageInput,inputOperation,operationReceipt} from '@devmesh/contracts';

export const draftContext=z.discriminatedUnion('form',[
  z.strictObject({principalId:opaqueKey,form:z.literal('project'),projectId:z.null(),runId:z.null(),basisRevision:z.null()}),
  z.strictObject({principalId:opaqueKey,form:z.literal('message'),projectId:ids.project,runId:ids.run,basisRevision:revision}),
]);
export type DraftContext=z.output<typeof draftContext>;
const draftFields=z.strictObject({text:z.string().max(40000),name:z.string().max(80)});
const draftRecord=z.strictObject({key:z.string(),context:draftContext,revision,clientDraftId:z.uuid(),...draftFields.shape,updatedAt:timestamp,pendingKey:z.uuid().nullable()});
export type LocalDraft=z.output<typeof draftRecord>;
const envelopeBase={key:z.uuid(),context:draftContext,draftRevision:revision,createdAt:timestamp};
const commandEnvelope=z.discriminatedUnion('kind',[
  z.strictObject({...envelopeBase,kind:z.literal('project'),scope:z.literal('projects.create'),path:z.literal('/api/v1/projects'),ifMatch:z.null(),body:createProjectInput}),
  z.strictObject({...envelopeBase,kind:z.literal('message'),scope:ids.run,path:z.string(),ifMatch:z.string(),body:saveMessageInput}),
]).superRefine((v,c)=>{
  if(v.kind!==v.context.form)c.addIssue({code:'custom',message:'Wrong command context'});
  if(v.kind==='message'&&(v.context.form!=='message'||v.scope!==v.context.runId||v.path!==`/api/v1/runs/${v.context.runId}/messages`||v.ifMatch!==`"r${v.context.basisRevision}"`))c.addIssue({code:'custom',message:'Wrong original request'});
});
const commandRecord=z.strictObject({key:z.uuid(),formKey:z.string(),envelope:commandEnvelope,receipt:inputOperation.nullable(),observedAt:timestamp.nullable(),pendingForm:z.string().optional()});
export type LocalCommand=z.output<typeof commandRecord>;
const contextKey=(c:DraftContext)=>JSON.stringify([c.principalId,c.projectId,c.runId,c.form,c.basisRevision]);
const formKey=(c:DraftContext)=>JSON.stringify([c.principalId,c.projectId,c.runId,c.form]);
export class WorkbenchLocalError extends Error{
  constructor(readonly code:'STORAGE_UNAVAILABLE'|'STORAGE_BLOCKED'|'STORAGE_CLOSED'|'LOCAL_CONFLICT'|'COMMAND_PENDING'|'LOCAL_RECORD_INVALID'){super(code);}
}
const invalid=():never=>{throw new WorkbenchLocalError('LOCAL_RECORD_INVALID');};
const stable=(v:unknown)=>JSON.stringify(v,(_k,x:unknown)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a<b?-1:a>b?1:0)):x);

/** Browser storage is a recovery aid; all server permissions still apply. */
export async function openWorkbenchLocal(principalId:string){
  opaqueKey.parse(principalId);
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    let settled=false;
    const fail=(code:'STORAGE_UNAVAILABLE'|'STORAGE_BLOCKED')=>{if(!settled){settled=true;reject(new WorkbenchLocalError(code));}};
    let request:IDBOpenDBRequest;
    try{request=indexedDB.open('devmesh.workbench',1);}catch{fail('STORAGE_UNAVAILABLE');return;}
    const timer=setTimeout(()=>fail('STORAGE_UNAVAILABLE'),10000);
    request.onblocked=()=>{clearTimeout(timer);fail('STORAGE_BLOCKED');};
    request.onerror=()=>{clearTimeout(timer);fail('STORAGE_UNAVAILABLE');};
    request.onupgradeneeded=()=>{
      if(settled){request.transaction!.abort();return;}
      request.result.createObjectStore('drafts',{keyPath:'key'});
      request.result.createObjectStore('commands',{keyPath:'key'}).createIndex('pendingForm','pendingForm',{unique:true});
    };
    request.onsuccess=()=>{
      clearTimeout(timer);
      if(settled){request.result.close();return;}
      settled=true;
      if(!request.result.objectStoreNames.contains('drafts')||!request.result.objectStoreNames.contains('commands')){request.result.close();reject(new WorkbenchLocalError('LOCAL_RECORD_INVALID'));return;}
      resolve(request.result);
    };
  });
  let closed=false;
  const close=()=>{closed=true;db.close();};
  db.onversionchange=close;
  db.onclose=()=>{closed=true;};
  function context(input:DraftContext){const c=draftContext.parse(input);if(c.principalId!==principalId)invalid();return c;}
  function draft(value:unknown,c:DraftContext){if(value===undefined)return null;const d=draftRecord.parse(value);if(d.key!==contextKey(c)||stable(d.context)!==stable(c))invalid();return d;}
  function command(value:unknown){
    const v=commandRecord.parse(value),c=v.envelope.context;
    if(v.key!==v.envelope.key||c.principalId!==principalId||v.formKey!==formKey(c)||(v.pendingForm!==undefined&&v.pendingForm!==v.formKey)||((v.pendingForm===undefined)!==(v.receipt?.status==='SUCCEEDED'))||((v.receipt===null)!==(v.observedAt===null)))invalid();
    if(v.receipt?.status==='SUCCEEDED'){
      const result=z.object({projectId:ids.project,runId:ids.run,messageId:ids.message}).parse(v.receipt.result);
      if(c.form==='message'&&(result.projectId!==c.projectId||result.runId!==c.runId))invalid();
    }
    return v;
  }
  type Session={get:(store:IDBObjectStore|IDBIndex,key:IDBValidKey,next:(v:unknown)=>void)=>void;drafts:IDBObjectStore;commands:IDBObjectStore};
  function transaction<T>(mode:IDBTransactionMode,body:(s:Session,done:(value:T)=>void)=>void):Promise<T>{
    if(closed)return Promise.reject(new WorkbenchLocalError('STORAGE_CLOSED'));
    return new Promise((resolve,reject)=>{
      let tx:IDBTransaction;
      try{tx=db.transaction(['drafts','commands'],mode);}catch{reject(new WorkbenchLocalError('STORAGE_UNAVAILABLE'));return;}
      let result:T,ready=false,reason:unknown;
      const guard=(work:()=>void)=>{try{work();}catch(e){reason=e;tx.abort();}};
      tx.oncomplete=()=>{if(ready)resolve(result);else reject(new WorkbenchLocalError('LOCAL_RECORD_INVALID'));};
      tx.onabort=()=>reject(reason instanceof WorkbenchLocalError?reason:new WorkbenchLocalError(reason?'LOCAL_RECORD_INVALID':'STORAGE_UNAVAILABLE'));
      const s:Session={drafts:tx.objectStore('drafts'),commands:tx.objectStore('commands'),get(store,key,next){const r=store.get(key);r.onsuccess=()=>guard(()=>next(r.result as unknown));}};
      guard(()=>body(s,value=>{result=value;ready=true;}));
    });
  }
  function pending(s:Session,c:DraftContext,next:(v:LocalCommand|null)=>void){s.get(s.commands.index('pendingForm'),formKey(c),raw=>{
    if(raw===undefined){next(null);return;}
    const p=command(raw);if(p.pendingForm!==formKey(c)||p.formKey!==formKey(c))invalid();
    s.get(s.drafts,contextKey(p.envelope.context),rawDraft=>{
      const d=draft(rawDraft,p.envelope.context);if(!d||d.pendingKey!==p.key||d.revision!==p.envelope.draftRevision+1)invalid();next(p);
    });
  });}
  function load(input:DraftContext){const c=context(input);return transaction<{draft:LocalDraft|null;pending:LocalCommand|null}>('readonly',(s,done)=>s.get(s.drafts,contextKey(c),raw=>{
    const d=draft(raw,c);pending(s,c,p=>{if(d?.pendingKey&&p?.key!==d.pendingKey)invalid();done({draft:d,pending:p});});
  }));}
  function save(input:DraftContext,expectedRevision:number,fields:z.input<typeof draftFields>){
    const c=context(input),value=draftFields.parse(fields);z.number().int().min(0).max(Number.MAX_SAFE_INTEGER-1).parse(expectedRevision);
    return transaction<LocalDraft>('readwrite',(s,done)=>pending(s,c,p=>{
      if(p)throw new WorkbenchLocalError('COMMAND_PENDING');
      s.get(s.drafts,contextKey(c),raw=>{
        const old=draft(raw,c);if(old?.pendingKey)invalid();if((old?.revision??0)!==expectedRevision)throw new WorkbenchLocalError('LOCAL_CONFLICT');
        const d=draftRecord.parse({key:contextKey(c),context:c,revision:expectedRevision+1,clientDraftId:old?.clientDraftId??crypto.randomUUID(),...value,updatedAt:new Date().toISOString(),pendingKey:null});s.drafts.put(d);done(d);
      });
    }));
  }
  function enqueue(input:DraftContext,expectedRevision:number){
    const c=context(input);revision.parse(expectedRevision);
    return transaction<{draft:LocalDraft;command:LocalCommand}>('readwrite',(s,done)=>pending(s,c,p=>{
      if(p)throw new WorkbenchLocalError('COMMAND_PENDING');
      s.get(s.drafts,contextKey(c),raw=>{
        const d=draft(raw,c);if(!d||d.revision!==expectedRevision)throw new WorkbenchLocalError('LOCAL_CONFLICT');if(d.pendingKey)invalid();
        const key=crypto.randomUUID(),createdAt=new Date().toISOString(),common={key,context:c,draftRevision:d.revision,createdAt};
        const envelope=commandEnvelope.parse(c.form==='project'?{...common,kind:'project',scope:'projects.create',path:'/api/v1/projects',ifMatch:null,body:{initialRequest:{text:d.text,attachmentIds:[]},clientDraftId:d.clientDraftId,...(d.name?{name:d.name}:{})}}:{...common,kind:'message',scope:c.runId,path:`/api/v1/runs/${c.runId}/messages`,ifMatch:`"r${c.basisRevision}"`,body:{text:d.text,attachmentIds:[],clientMessageId:d.clientDraftId}});
        const v=commandRecord.parse({key,formKey:formKey(c),pendingForm:formKey(c),envelope,receipt:null,observedAt:null}),updated=draftRecord.parse({...d,revision:d.revision+1,pendingKey:key,updatedAt:createdAt});
        s.commands.add(v);s.drafts.put(updated);done({draft:updated,command:v});
      });
    }));
  }
  function getCommand(key:string){z.uuid().parse(key);return transaction<LocalCommand|null>('readonly',(s,done)=>s.get(s.commands,key,raw=>{if(raw===undefined){done(null);return;}const v=commandRecord.parse(raw);done(v.envelope.context.principalId===principalId?command(v):null);}));}
  function observe(key:string,input:z.input<typeof inputOperation>|z.input<typeof operationReceipt>){
    z.uuid().parse(key);
    const parsed=z.union([inputOperation,operationReceipt]).safeParse(input);if(!parsed.success)return invalid();
    const value=parsed.data;
    if('resource' in value){
      const result=z.object({projectId:ids.project,runId:ids.run,revision}).safeParse(value.result);
      if(!result.success||value.resource.projectId!==result.data.projectId||value.resource.runId!==result.data.runId||value.resource.revision!==result.data.revision||value.links.operation!==`/api/v1/operations/${value.operationId}`)return invalid();
    }
    const receipt=inputOperation.parse({operationId:value.operationId,status:value.status,result:value.result??null});
    return transaction<LocalCommand>('readwrite',(s,done)=>s.get(s.commands,key,raw=>{
      const old=command(raw),c=old.envelope.context;
      if(old.receipt&&old.receipt.operationId!==receipt.operationId)invalid();
      if(old.receipt?.status==='SUCCEEDED'){if(stable(old.receipt)!==stable(receipt))invalid();done(old);return;}
      const observedAt=new Date().toISOString();
      if(receipt.status!=='SUCCEEDED'){const v=commandRecord.parse({...old,receipt,observedAt});s.commands.put(v);done(v);return;}
      const result=z.object({projectId:ids.project,runId:ids.run,messageId:ids.message}).parse(receipt.result);
      if(c.form==='message'&&(result.projectId!==c.projectId||result.runId!==c.runId))invalid();
      s.get(s.drafts,contextKey(c),rawDraft=>{
        const d=draft(rawDraft,c);if(!d||d.pendingKey!==key||d.revision!==old.envelope.draftRevision+1)return invalid();
        const {pendingForm:_pendingForm,...rest}=old,v=commandRecord.parse({...rest,receipt,observedAt});
        s.commands.put(v);s.drafts.put(draftRecord.parse({...d,revision:d.revision+1,text:'',name:'',clientDraftId:crypto.randomUUID(),pendingKey:null,updatedAt:observedAt}));done(v);
      });
    }));
  }
  return {load,save,enqueue,getCommand,observe,close};
}
