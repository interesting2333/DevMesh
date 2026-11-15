import {z} from 'zod';
import {ids,opaqueKey,revision,timestamp,sha256,commandBodies,createProjectInput,saveMessageInput,answerQuestionsInput,inputOperation,operationReceipt,inputOperationLookup,attachmentView} from '@devmesh/contracts';
import {prepareUpload,uploadRecord,uploadResponse,uploadLimits,verifyUploadBytes,sameUploadBytes} from './workbench-upload.js';
import type {LocalUpload} from './workbench-upload.js';

const answerBasis=z.strictObject({requirementRevision:revision,questions:z.array(z.strictObject({questionId:ids.question,questionRevision:revision,optionIds:z.array(opaqueKey).max(32)})).max(100)}).superRefine((v,c)=>{if(new Set(v.questions.map(q=>q.questionId)).size!==v.questions.length||v.questions.some(q=>new Set(q.optionIds).size!==q.optionIds.length))c.addIssue({code:'custom',message:'Duplicate answer basis'});});
export const draftContext=z.discriminatedUnion('form',[
  z.strictObject({principalId:opaqueKey,form:z.literal('project'),projectId:z.null(),runId:z.null(),basisRevision:z.null()}),
  z.strictObject({principalId:opaqueKey,form:z.literal('message'),projectId:ids.project,runId:ids.run,basisRevision:revision}),
  z.strictObject({principalId:opaqueKey,form:z.literal('questions-answer'),projectId:ids.project,runId:ids.run,basisRevision:revision,basis:answerBasis}),
  z.strictObject({principalId:opaqueKey,form:z.literal('plan-confirm'),projectId:ids.project,runId:ids.run,basisRevision:revision,basis:z.strictObject({planRevision:revision,requirementRevision:revision,reviewHash:sha256,carryForwardHash:sha256.optional()})}),
]);
export type DraftContext=z.output<typeof draftContext>;
const draftFields=z.strictObject({text:z.string().max(40000),name:z.string().max(80),answers:z.array(answerQuestionsInput.shape.answers.element).max(100).optional()});
const draftRecord=z.strictObject({key:z.string(),context:draftContext,revision,clientDraftId:z.uuid(),...draftFields.shape,uploadKeys:z.array(z.uuid()).max(3).refine(v=>new Set(v).size===v.length).optional(),updatedAt:timestamp,pendingKey:z.uuid().nullable(),closedKey:z.uuid().optional(),previousClosedKey:z.uuid().optional()});
export type LocalDraft=z.output<typeof draftRecord>;
const envelopeBase={key:z.uuid(),context:draftContext,draftRevision:revision,createdAt:timestamp};
const commandEnvelope=z.discriminatedUnion('kind',[
  z.strictObject({...envelopeBase,kind:z.literal('project'),scope:z.literal('projects.create'),path:z.literal('/api/v1/projects'),ifMatch:z.null(),body:createProjectInput}),
  z.strictObject({...envelopeBase,kind:z.literal('message'),scope:ids.run,path:z.string(),ifMatch:z.string(),body:saveMessageInput}),
  z.strictObject({...envelopeBase,kind:z.literal('questions-answer'),scope:ids.run,path:z.string(),ifMatch:z.string(),body:answerQuestionsInput}),
  z.strictObject({...envelopeBase,kind:z.literal('plan-confirm'),scope:ids.run,path:z.string(),ifMatch:z.string(),body:commandBodies.ConfirmPlan}),
]).superRefine((v,c)=>{
  if(v.kind!==v.context.form)c.addIssue({code:'custom',message:'Wrong command context'});
  if(v.kind==='message'&&(v.context.form!=='message'||v.scope!==v.context.runId||v.path!==`/api/v1/runs/${v.context.runId}/messages`||v.ifMatch!==`"r${v.context.basisRevision}"`))c.addIssue({code:'custom',message:'Wrong original request'});
  if(v.kind==='questions-answer'){
    if(v.context.form!=='questions-answer'||v.scope!==v.context.runId||v.path!==`/api/v1/runs/${v.context.runId}/questions:answer`||v.ifMatch!==`"r${v.context.basisRevision}"`)c.addIssue({code:'custom',message:'Wrong answer request'});
    else for(const a of v.body.answers){const q=v.context.basis.questions.find(q=>q.questionId===a.questionId);if(!q||q.questionRevision!==a.questionRevision||typeof a.value!=='string'||!a.value.trim()||q.optionIds.length&&!q.optionIds.includes(a.value))c.addIssue({code:'custom',message:'Answer differs from reviewed question'});}
  }
  if(v.kind==='plan-confirm'){
    const b=v.context.form==='plan-confirm'?v.context.basis:null;
    if(!b||v.context.form!=='plan-confirm'||v.scope!==v.context.runId||v.path!==`/api/v1/runs/${v.context.runId}/plans/${b.planRevision}:confirm`||v.ifMatch!==`"r${v.context.basisRevision}"`||v.body.requirementRevision!==b.requirementRevision||v.body.reviewHash!==b.reviewHash||v.body.carryForwardHash!==b.carryForwardHash)c.addIssue({code:'custom',message:'Wrong plan confirmation basis'});
  }
});
export const staleOriginalProof=z.strictObject({reason:z.literal('STALE_BASIS'),key:z.uuid(),projectId:ids.project,runId:ids.run,resourceRevision:revision,workspaceReadAt:timestamp,lookupReadAt:timestamp,lookup:inputOperationLookup.extend({operation:z.null()})});
export const removedOriginalProof=z.strictObject({reason:z.literal('REMOVED_ATTACHMENT'),key:z.uuid(),attachment:attachmentView.extend({state:z.literal('REMOVED')}),attachmentReadAt:timestamp,lookupReadAt:timestamp,lookup:inputOperationLookup.extend({operation:z.null()})});
const removedClosure=removedOriginalProof.extend({draftSnapshot:draftRecord});
const closedHistoryCursor=z.strictObject({rootKey:z.uuid(),anchorKey:z.uuid()});
const commandRecord=z.strictObject({key:z.uuid(),formKey:z.string(),envelope:commandEnvelope,receipt:inputOperation.nullable(),observedAt:timestamp.nullable(),pendingForm:z.string().optional(),closure:z.discriminatedUnion('reason',[staleOriginalProof,removedClosure]).optional()});
export type LocalCommand=z.output<typeof commandRecord>;
const contextKey=(c:DraftContext)=>JSON.stringify([c.principalId,c.projectId,c.runId,c.form,c.basisRevision,...(c.form==='plan-confirm'?[c.basis.planRevision,c.basis.requirementRevision,c.basis.reviewHash,c.basis.carryForwardHash??null]:c.form==='questions-answer'?[c.basis.requirementRevision,c.basis.questions.map(q=>[q.questionId,q.questionRevision])]:[])]);
const pendingScope=z.strictObject({principalId:opaqueKey,projectId:ids.project,runId:ids.run,form:z.enum(['message','questions-answer','plan-confirm'])});
type FormScope=Pick<DraftContext,'principalId'|'projectId'|'runId'|'form'>;
const formKey=(c:FormScope)=>JSON.stringify([c.principalId,c.projectId,c.runId,c.form]);
export class WorkbenchLocalError extends Error{
  constructor(readonly code:'STORAGE_UNAVAILABLE'|'STORAGE_BLOCKED'|'STORAGE_CLOSED'|'LOCAL_CONFLICT'|'COMMAND_PENDING'|'COMMAND_CLOSED'|'LOCAL_RECORD_INVALID'|'UPLOAD_LIMIT'|'UPLOAD_NOT_READY'){super(code);}
}
const invalid=():never=>{throw new WorkbenchLocalError('LOCAL_RECORD_INVALID');};
const stable=(v:unknown)=>JSON.stringify(v,(_k,x:unknown)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a<b?-1:a>b?1:0)):x);
function validateDraftFields(c:DraftContext,value:z.output<typeof draftFields>){
 if(c.form!=='questions-answer'){if(value.answers!==undefined)invalid();return;}
 if(value.answers===undefined)return invalid();
 if(value.text!==''||value.name!==''||new Set(value.answers.map(a=>a.questionId)).size!==value.answers.length||new TextEncoder().encode(JSON.stringify({answers:value.answers})).byteLength>128*1024)invalid();
 for(const a of value.answers){const q=c.basis.questions.find(q=>q.questionId===a.questionId);if(!q||q.questionRevision!==a.questionRevision||typeof a.value!=='string'||q.optionIds.length&&!q.optionIds.includes(a.value))invalid();}
}


/** Browser storage is a recovery aid; all server permissions still apply. */
export async function openWorkbenchLocal(principalId:string){
  opaqueKey.parse(principalId);
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    let settled=false;
    const fail=(code:'STORAGE_UNAVAILABLE'|'STORAGE_BLOCKED')=>{if(!settled){settled=true;reject(new WorkbenchLocalError(code));}};
    let request:IDBOpenDBRequest;
    try{request=indexedDB.open('devmesh.workbench',2);}catch{fail('STORAGE_UNAVAILABLE');return;}
    const timer=setTimeout(()=>fail('STORAGE_UNAVAILABLE'),10000);
    request.onblocked=()=>{clearTimeout(timer);fail('STORAGE_BLOCKED');};
    request.onerror=()=>{clearTimeout(timer);fail('STORAGE_UNAVAILABLE');};
    request.onupgradeneeded=e=>{
      if(settled){request.transaction!.abort();return;}
      try{
        if(e.oldVersion===0){
          request.result.createObjectStore('drafts',{keyPath:'key'});
          request.result.createObjectStore('commands',{keyPath:'key'}).createIndex('pendingForm','pendingForm',{unique:true});
        }
        request.result.createObjectStore('uploads',{keyPath:'key'}).createIndex('principalId','principalId');
      }catch{try{request.transaction?.abort();}catch{/* An already aborted upgrade has no active transaction. */}}
    };
    request.onsuccess=()=>{
      clearTimeout(timer);
      if(settled){request.result.close();return;}
      settled=true;
      const database=request.result;
      try{
        const tx=database.transaction(['drafts','commands','uploads'],'readonly'),commands=tx.objectStore('commands'),uploads=tx.objectStore('uploads');
        if(tx.objectStore('drafts').keyPath!=='key'||commands.keyPath!=='key'||uploads.keyPath!=='key'||commands.index('pendingForm').keyPath!=='pendingForm'||!commands.index('pendingForm').unique||uploads.index('principalId').keyPath!=='principalId'||uploads.index('principalId').unique)throw Error('Invalid schema');
      }catch{database.close();reject(new WorkbenchLocalError('LOCAL_RECORD_INVALID'));return;}
      resolve(request.result);
    };
  });
  let closed=false;
  const close=()=>{closed=true;db.close();};
  db.onversionchange=close;
  db.onclose=()=>{closed=true;};
  function context(input:DraftContext){const c=draftContext.parse(input);if(c.principalId!==principalId)invalid();return c;}
  function draft(value:unknown,c:DraftContext){if(value===undefined)return null;const d=draftRecord.parse(value);validateDraftFields(c,d);if(d.key!==contextKey(c)||stable(d.context)!==stable(c)||d.closedKey&&d.pendingKey||c.form==='questions-answer'&&(d.text!==''||d.name!==''||d.answers===undefined)||c.form!=='questions-answer'&&d.answers!==undefined||c.form!=='project'&&c.form!=='message'&&(d.uploadKeys!==undefined||d.previousClosedKey!==undefined)||d.previousClosedKey===d.closedKey&&d.closedKey!==undefined)invalid();return d;}
  function success(envelope:LocalCommand['envelope'],result:unknown){
    const r=z.object({projectId:ids.project,runId:ids.run,revision}).parse(result),c=envelope.context;
    if(c.form!=='project'&&(r.projectId!==c.projectId||r.runId!==c.runId))invalid();
    if(envelope.kind==='plan-confirm'){const p=z.object({planRevision:revision}).parse(result);if(c.form!=='plan-confirm'||p.planRevision!==c.basis.planRevision)invalid();}
    else if(envelope.kind==='questions-answer')z.object({interpretationOperationId:ids.operation}).parse(result);
    else z.object({messageId:ids.message}).parse(result);
  }
  function command(value:unknown){
    const v=commandRecord.parse(value),c=v.envelope.context;
    if(v.key!==v.envelope.key||c.principalId!==principalId||v.formKey!==formKey(c)||(v.pendingForm!==undefined&&v.pendingForm!==v.formKey)||((v.pendingForm===undefined)!==(v.receipt?.status==='SUCCEEDED'||v.closure!==undefined))||((v.receipt===null)!==(v.observedAt===null)))invalid();
    const proof=v.closure;
    if(proof){
      if(v.receipt!==null||proof.key!==v.key||proof.lookup.principalId!==c.principalId||proof.lookup.scope!==v.envelope.scope||proof.lookup.key!==v.key)invalid();
      if(proof.reason==='STALE_BASIS'){
        if(c.form==='project'||proof.projectId!==c.projectId||proof.runId!==c.runId||proof.resourceRevision<=c.basisRevision||Date.parse(proof.lookupReadAt)<Date.parse(proof.workspaceReadAt))invalid();
      }else{
        const e=v.envelope,ids=e.kind==='project'?e.body.initialRequest.attachmentIds:e.kind==='message'?e.body.attachmentIds:[];
        if((e.kind!=='project'&&e.kind!=='message')||!ids.includes(proof.attachment.attachmentId)||Date.parse(proof.lookupReadAt)<Date.parse(proof.attachmentReadAt))invalid();
        const d=draft(proof.draftSnapshot,c);if(!d)return invalid();if(d.pendingKey!==v.key||d.closedKey||d.revision!==e.draftRevision+1)invalid();
        if(e.kind==='project'&&(d.clientDraftId!==e.body.clientDraftId||d.text!==e.body.initialRequest.text||d.name!==(e.body.name??'')))invalid();
        if(e.kind==='message'&&(d.clientDraftId!==e.body.clientMessageId||d.text!==e.body.text))invalid();
      }
    }
    if(v.receipt?.status==='SUCCEEDED'){
      success(v.envelope,v.receipt.result);
    }
    return v;
  }
  type Session={get:(store:IDBObjectStore|IDBIndex,key:IDBValidKey,next:(v:unknown)=>void)=>void;all:(store:IDBObjectStore|IDBIndex,key:IDBValidKey,next:(v:unknown[])=>void)=>void;scan:(range:IDBKeyRange,next:(cursor:IDBCursorWithValue|null)=>void)=>void;drafts:IDBObjectStore;commands:IDBObjectStore;uploads:IDBObjectStore};
  function transaction<T>(mode:IDBTransactionMode,body:(s:Session,done:(value:T)=>void)=>void):Promise<T>{
    if(closed)return Promise.reject(new WorkbenchLocalError('STORAGE_CLOSED'));
    return new Promise((resolve,reject)=>{
      let tx:IDBTransaction;
      try{tx=db.transaction(['drafts','commands','uploads'],mode);}catch{reject(new WorkbenchLocalError('STORAGE_UNAVAILABLE'));return;}
      let result:T,ready=false,reason:unknown;
      const guard=(work:()=>void)=>{try{work();}catch(e){reason=e;tx.abort();}};
      tx.oncomplete=()=>{if(ready)resolve(result);else reject(new WorkbenchLocalError('LOCAL_RECORD_INVALID'));};
      tx.onabort=()=>reject(reason instanceof WorkbenchLocalError?reason:new WorkbenchLocalError(reason?'LOCAL_RECORD_INVALID':'STORAGE_UNAVAILABLE'));
      const s:Session={drafts:tx.objectStore('drafts'),commands:tx.objectStore('commands'),uploads:tx.objectStore('uploads'),get(store,key,next){const r=store.get(key);r.onsuccess=()=>guard(()=>next(r.result as unknown));},all(store,key,next){const r=store.getAll(key);r.onsuccess=()=>guard(()=>next(r.result as unknown[]));},scan(range,next){const r=tx.objectStore('drafts').openCursor(range,'prev');r.onsuccess=()=>guard(()=>next(r.result));}};
      guard(()=>body(s,value=>{result=value;ready=true;}));
    });
  }
  function pending(s:Session,c:FormScope,next:(v:LocalCommand|null)=>void){s.get(s.commands.index('pendingForm'),formKey(c),raw=>{
    if(raw===undefined){next(null);return;}
    const p=command(raw);if(p.pendingForm!==formKey(c)||p.formKey!==formKey(c))invalid();
    s.get(s.drafts,contextKey(p.envelope.context),rawDraft=>{
      const d=draft(rawDraft,p.envelope.context);if(!d||d.pendingKey!==p.key||d.revision!==p.envelope.draftRevision+1)invalid();next(p);
    });
  });}
  function load(input:DraftContext){const c=context(input);return transaction<{draft:LocalDraft|null;pending:LocalCommand|null}>('readonly',(s,done)=>s.get(s.drafts,contextKey(c),raw=>{
    const d=draft(raw,c);pending(s,c,p=>{if(d?.pendingKey&&p?.key!==d.pendingKey)invalid();done({draft:d,pending:p});});
  }));}
  /** Recover an existing Run command even when no fresh form basis is readable. */
  function getPending(input:z.input<typeof pendingScope>){const c=pendingScope.parse(input);if(c.principalId!==principalId)return invalid();return transaction<LocalCommand|null>('readonly',(s,done)=>pending(s,c,done));}
  /** Old basis drafts are references, never silently copied into a new request. */
  function references(input:DraftContext,afterKey?:string){
    const c=context(input),prefix=formKey(c).slice(0,-1)+',';
    if(afterKey!==undefined&&(!afterKey.startsWith(prefix)||afterKey.length>65536))return invalid();
    return transaction<{items:LocalDraft[];nextCursor:string|null}>('readonly',(s,done)=>{
      const items:LocalDraft[]=[],range=IDBKeyRange.bound(prefix,afterKey??prefix+'\uffff',false,afterKey!==undefined);let scanned=0;
      s.scan(range,cursor=>{
        if(!cursor){done({items,nextCursor:null});return;}
        const raw=draftRecord.parse(cursor.value),d=draft(raw,context(raw.context));if(!d||formKey(d.context)!==formKey(c))return invalid();
        scanned++;if(d.context.basisRevision!==c.basisRevision&&(d.text||d.name||d.answers?.length||d.closedKey||d.previousClosedKey))items.push(d);
        if(items.length===10||scanned===50){done({items,nextCursor:String(cursor.key)});return;}cursor.continue();
      });
    });
  }
  function save(input:DraftContext,expectedRevision:number,fields:z.input<typeof draftFields>){
    const c=context(input),value=draftFields.parse(fields);validateDraftFields(c,value);z.number().int().min(0).max(Number.MAX_SAFE_INTEGER-1).parse(expectedRevision);
    return transaction<LocalDraft>('readwrite',(s,done)=>pending(s,c,p=>{
      if(p)throw new WorkbenchLocalError('COMMAND_PENDING');
      s.get(s.drafts,contextKey(c),raw=>{
        const old=draft(raw,c);if(old?.closedKey)throw new WorkbenchLocalError('COMMAND_CLOSED');if(old?.pendingKey)invalid();if((old?.revision??0)!==expectedRevision)throw new WorkbenchLocalError('LOCAL_CONFLICT');
        const d=draftRecord.parse({key:contextKey(c),context:c,revision:expectedRevision+1,clientDraftId:old?.clientDraftId??crypto.randomUUID(),...value,...(old?.uploadKeys?{uploadKeys:old.uploadKeys}:{}),...(old?.previousClosedKey?{previousClosedKey:old.previousClosedKey}:{}),updatedAt:new Date().toISOString(),pendingKey:null});s.drafts.put(d);done(d);
      });
    }));
  }
  async function enqueue(input:DraftContext,expectedRevision:number,expectedUploads:LocalUpload[]=[]){
    const c=context(input);revision.parse(expectedRevision);
    if(expectedUploads.length>3||new Set(expectedUploads.map(v=>v.key)).size!==expectedUploads.length)return invalid();
    const verified=await Promise.all(expectedUploads.map(v=>verifyUploadBytes(upload(v))));
    return transaction<{draft:LocalDraft;command:LocalCommand}>('readwrite',(s,done)=>pending(s,c,p=>{
      if(p)throw new WorkbenchLocalError('COMMAND_PENDING');
      s.get(s.drafts,contextKey(c),raw=>{
        const d=draft(raw,c);if(d?.closedKey)throw new WorkbenchLocalError('COMMAND_CLOSED');if(!d||d.revision!==expectedRevision)throw new WorkbenchLocalError('LOCAL_CONFLICT');if(d.pendingKey)invalid();
        if(stable(d.uploadKeys??[])!==stable(verified.map(v=>v.key)))throw new WorkbenchLocalError('UPLOAD_NOT_READY');
        selected(s,d,uploads=>{
        for(let i=0;i<uploads.length;i++)if(!sameUpload(uploads[i]!,verified[i]!))throw new WorkbenchLocalError('LOCAL_CONFLICT');
        const attachmentIds=uploads.map(v=>{if(v.receipt?.status!=='SUCCEEDED'||v.attachment?.state!=='READY'||!v.verifiedAt)throw new WorkbenchLocalError('UPLOAD_NOT_READY');return v.attachment.attachmentId;});
        if(new Set(attachmentIds).size!==attachmentIds.length)return invalid();
        const key=crypto.randomUUID(),createdAt=new Date().toISOString(),common={key,context:c,draftRevision:d.revision,createdAt};
        if(c.form==='plan-confirm'&&(d.text!=='CONFIRM_PLAN'||d.name!==''))return invalid();
        const envelope=commandEnvelope.parse(c.form==='project'?{...common,kind:'project',scope:'projects.create',path:'/api/v1/projects',ifMatch:null,body:{initialRequest:{text:d.text,attachmentIds},clientDraftId:d.clientDraftId,...(d.name?{name:d.name}:{})}}:c.form==='message'?{...common,kind:'message',scope:c.runId,path:`/api/v1/runs/${c.runId}/messages`,ifMatch:`"r${c.basisRevision}"`,body:{text:d.text,attachmentIds,clientMessageId:d.clientDraftId}}:c.form==='questions-answer'?{...common,kind:'questions-answer',scope:c.runId,path:`/api/v1/runs/${c.runId}/questions:answer`,ifMatch:`"r${c.basisRevision}"`,body:{answers:d.answers}}:{...common,kind:'plan-confirm',scope:c.runId,path:`/api/v1/runs/${c.runId}/plans/${c.basis.planRevision}:confirm`,ifMatch:`"r${c.basisRevision}"`,body:{requirementRevision:c.basis.requirementRevision,reviewHash:c.basis.reviewHash,...(c.basis.carryForwardHash?{carryForwardHash:c.basis.carryForwardHash}:{})}});
        const v=commandRecord.parse({key,formKey:formKey(c),pendingForm:formKey(c),envelope,receipt:null,observedAt:null}),updated=draftRecord.parse({...d,revision:d.revision+1,pendingKey:key,updatedAt:createdAt});
        s.commands.add(v);s.drafts.put(updated);done({draft:updated,command:v});
        });
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
      const old=command(raw),c=old.envelope.context;if(old.closure)throw new WorkbenchLocalError('LOCAL_CONFLICT');
      if(old.receipt&&old.receipt.operationId!==receipt.operationId)invalid();
      if(old.receipt?.status==='SUCCEEDED'){if(stable(old.receipt)!==stable(receipt))invalid();done(old);return;}
      const observedAt=new Date().toISOString();
      if(receipt.status!=='SUCCEEDED'){const v=commandRecord.parse({...old,receipt,observedAt});s.commands.put(v);done(v);return;}
      success(old.envelope,receipt.result);
      s.get(s.drafts,contextKey(c),rawDraft=>{
        const d=draft(rawDraft,c);if(!d||d.pendingKey!==key||d.revision!==old.envelope.draftRevision+1)return invalid();
        const {pendingForm:_pendingForm,...rest}=old,v=commandRecord.parse({...rest,receipt,observedAt});
        s.commands.put(v);s.drafts.put(draftRecord.parse({...d,revision:d.revision+1,text:'',name:'',...(c.form==='questions-answer'?{answers:[]}:{}),...(d.uploadKeys?{uploadKeys:[]}:{}),clientDraftId:crypto.randomUUID(),pendingKey:null,updatedAt:observedAt}));done(v);
      });
    }));
  }
  function closeStale(expected:LocalCommand,input:z.input<typeof staleOriginalProof>){
    const snapshot=command(expected),proof=staleOriginalProof.parse(input),c=snapshot.envelope.context;
    if(c.form==='project'||snapshot.receipt||snapshot.closure||proof.key!==snapshot.key||proof.lookup.principalId!==c.principalId||proof.lookup.scope!==snapshot.envelope.scope||proof.lookup.key!==snapshot.key||proof.projectId!==c.projectId||proof.runId!==c.runId||proof.resourceRevision<=c.basisRevision||Date.parse(proof.lookupReadAt)<Date.parse(proof.workspaceReadAt))return invalid();
    return transaction<LocalCommand>('readwrite',(s,done)=>s.get(s.commands,snapshot.key,raw=>{
      const old=command(raw);if(stable(old)!==stable(snapshot))throw new WorkbenchLocalError('LOCAL_CONFLICT');
      pending(s,c,p=>{if(!p||p.key!==old.key)throw new WorkbenchLocalError('LOCAL_CONFLICT');s.get(s.drafts,contextKey(c),rawDraft=>{
        const d=draft(rawDraft,c);if(!d)return invalid();if(d.pendingKey!==old.key||d.revision!==old.envelope.draftRevision+1||d.closedKey)return invalid();
        const {pendingForm:_pendingForm,...rest}=old,v=commandRecord.parse({...rest,closure:proof});
        s.commands.put(v);s.drafts.put(draftRecord.parse({...d,revision:d.revision+1,pendingKey:null,closedKey:old.key,updatedAt:proof.lookupReadAt}));done(v);
      });});
    }));
  }
  /** A removed original is historical only after a protected ordered proof and exact native CAS. */
  function closeRemoved(expected:LocalCommand,expectedDraft:LocalDraft,input:z.input<typeof removedOriginalProof>){
    const snapshot=command(expected),c=snapshot.envelope.context,proof=removedOriginalProof.parse(input),d=draft(expectedDraft,c);
    if(snapshot.receipt||snapshot.closure||!d)return invalid();
    const {pendingForm:_pendingForm,...rest}=snapshot,value=command({...rest,closure:{...proof,draftSnapshot:d}});
    return transaction<LocalCommand>('readwrite',(s,done)=>s.get(s.commands,snapshot.key,raw=>{
      if(stable(command(raw))!==stable(snapshot))throw new WorkbenchLocalError('LOCAL_CONFLICT');
      pending(s,c,p=>{if(!p||p.key!==snapshot.key)throw new WorkbenchLocalError('LOCAL_CONFLICT');s.get(s.drafts,contextKey(c),rawDraft=>{
        const current=draft(rawDraft,c);if(!current||stable(current)!==stable(d))throw new WorkbenchLocalError('LOCAL_CONFLICT');
        s.commands.put(value);s.drafts.put(draftRecord.parse({...current,revision:current.revision+1,pendingKey:null,closedKey:value.key,updatedAt:proof.lookupReadAt}));done(value);
      });});
    }));
  }
  /** Explicit blank start preserves the complete closed original; it never sends or copies input. */
  function startBlankInput(expectedClosed:LocalCommand,expectedDraft:LocalDraft){
    const original=command(expectedClosed),proof=original.closure,c=original.envelope.context,d=draft(expectedDraft,c);
    if(!proof||proof.reason!=='REMOVED_ATTACHMENT'||!d||(c.form!=='project'&&c.form!=='message'))return invalid();
    const expected=draftRecord.parse({...proof.draftSnapshot,revision:proof.draftSnapshot.revision+1,pendingKey:null,closedKey:original.key,updatedAt:proof.lookupReadAt});if(stable(d)!==stable(expected))return invalid();
    return transaction<LocalDraft>('readwrite',(s,done)=>s.get(s.commands,original.key,raw=>{
      if(stable(command(raw))!==stable(original))throw new WorkbenchLocalError('LOCAL_CONFLICT');
      pending(s,c,p=>{if(p)throw new WorkbenchLocalError('COMMAND_PENDING');s.get(s.drafts,contextKey(c),rawDraft=>{
        const current=draft(rawDraft,c);if(!current||stable(current)!==stable(d))throw new WorkbenchLocalError('LOCAL_CONFLICT');
        const value=draftRecord.parse({key:d.key,context:c,revision:d.revision+1,clientDraftId:crypto.randomUUID(),text:'',name:'',uploadKeys:[],updatedAt:new Date().toISOString(),pendingKey:null,previousClosedKey:original.key});s.drafts.put(value);done(value);
      });});
    }));
  }
  /** Bounded immutable links, with rank checked again across the pagination anchor. */
  function closedHistory(input:DraftContext,after?:z.input<typeof closedHistoryCursor>){
    const c=context(input),cursor=after===undefined?null:closedHistoryCursor.parse(after);if(c.form!=='project'&&c.form!=='message')return invalid();
    return transaction<{items:LocalCommand[];nextCursor:z.output<typeof closedHistoryCursor>|null}>('readonly',(s,done)=>s.get(s.drafts,contextKey(c),raw=>{
      const d=draft(raw,c),items:LocalCommand[]=[];
      function item(raw:unknown){const v=command(raw);if(contextKey(v.envelope.context)!==contextKey(c)||v.closure?.reason!=='REMOVED_ATTACHMENT')return invalid();return {...v,closure:v.closure};}
      function begin(rootKey:string|undefined){
        if(!rootKey){if(cursor)return invalid();done({items,nextCursor:null});return;}
        if(cursor&&cursor.rootKey!==rootKey)throw new WorkbenchLocalError('LOCAL_CONFLICT');
        s.get(s.commands,rootKey,rawRoot=>{
          const root=item(rawRoot);
          function walk(key:string|undefined,upper:number|null){
            if(!key){done({items,nextCursor:null});return;}
            s.get(s.commands,key,rawItem=>{
              const v=item(rawItem);if(upper!==null&&v.envelope.draftRevision>=upper)return invalid();items.push(v);
              const next=v.closure.draftSnapshot.previousClosedKey;
              if(items.length===10){done({items,nextCursor:next?{rootKey:rootKey!,anchorKey:v.key}:null});return;}
              walk(next,v.envelope.draftRevision);
            });
          }
          if(!cursor){walk(rootKey,null);return;}
          s.get(s.commands,cursor.anchorKey,rawAnchor=>{const anchor=item(rawAnchor);if(anchor.key!==root.key&&anchor.envelope.draftRevision>=root.envelope.draftRevision)return invalid();walk(anchor.closure.draftSnapshot.previousClosedKey,anchor.envelope.draftRevision);});
        });
      }
      if(!d){begin(undefined);return;}
      if(!d.closedKey){begin(d.previousClosedKey);return;}
      s.get(s.commands,d.closedKey,rawClosed=>{const closed=command(rawClosed);if(contextKey(closed.envelope.context)!==contextKey(c)||!closed.closure)return invalid();begin(closed.closure.reason==='REMOVED_ATTACHMENT'?closed.key:d.previousClosedKey);});
    }));
  }
  function upload(value:unknown){
    const v=uploadRecord.parse(value),e=v.envelope,r=v.receipt,a=v.attachment;
    const suffix=e.metadata.name.toLowerCase().split('.').at(-1),mime=suffix==='txt'?'text/plain':suffix==='md'||suffix==='markdown'?'text/markdown':null;if(mime!==e.mime)return invalid();
    if(v.key!==e.key||v.principalId!==principalId||e.principalId!==principalId||(r===null)!==(v.observedAt===null)||(a===null)!==(v.verifiedAt===null)||(v.bytes===null)!==(v.releasedAt!==null)||v.bytes!==null&&v.bytes.byteLength!==e.byteSize||v.bytes===null&&r?.status!=='SUCCEEDED'&&r?.status!=='FAILED')invalid();
    if(r?.status==='SUCCEEDED'){
      const result=z.strictObject({attachmentId:ids.attachment}).parse(r.result);
      if(a&&(a.attachmentId!==result.attachmentId||a.clientAttachmentId!==e.metadata.clientAttachmentId||a.name!==e.metadata.name||a.byteSize!==e.byteSize))invalid();
    }else if(a)invalid();
    return v;
  }
  function sameUpload(a:LocalUpload,b:LocalUpload){const {bytes:x,...left}=a,{bytes:y,...right}=b;return stable(left)===stable(right)&&sameUploadBytes(x,y);}
  function selected(s:Session,d:LocalDraft,next:(v:LocalUpload[])=>void){
    const result:LocalUpload[]=[],keys=d.uploadKeys??[];
    const step=()=>{if(result.length===keys.length){next(result);return;}s.get(s.uploads,keys[result.length]!,raw=>{result.push(upload(raw));step();});};step();
  }
  function editable(s:Session,c:DraftContext,expectedRevision:number,next:(d:LocalDraft)=>void){
    if(c.form!=='project'&&c.form!=='message')return invalid();revision.parse(expectedRevision);
    pending(s,c,p=>{if(p)throw new WorkbenchLocalError('COMMAND_PENDING');s.get(s.drafts,contextKey(c),raw=>{
      const d=draft(raw,c);if(!d||d.revision!==expectedRevision)throw new WorkbenchLocalError('LOCAL_CONFLICT');if(d.closedKey)throw new WorkbenchLocalError('COMMAND_CLOSED');if(d.pendingKey)return invalid();next(d);
    });});
  }
  function withSelection(d:LocalDraft,keys:string[]){return draftRecord.parse({...d,revision:d.revision+1,uploadKeys:keys,updatedAt:new Date().toISOString()});}
  async function checkedUpload(value:LocalUpload){try{return await verifyUploadBytes(value);}catch{return invalid();}}
  async function addUpload(input:DraftContext,expectedRevision:number,file:File){
    const c=context(input);if(c.form!=='project'&&c.form!=='message')return invalid();
    const value=await prepareUpload(principalId,file);
    return transaction<{draft:LocalDraft;upload:LocalUpload}>('readwrite',(s,done)=>editable(s,c,expectedRevision,d=>{
      if((d.uploadKeys?.length??0)>=3)throw new WorkbenchLocalError('UPLOAD_LIMIT');
      s.all(s.uploads.index('principalId'),principalId,raw=>{
        const rows=raw.map(upload);if(rows.length>=uploadLimits.records||rows.filter(v=>v.bytes!==null).length>=uploadLimits.residentFiles)throw new WorkbenchLocalError('UPLOAD_LIMIT');
        const updated=withSelection(d,[...(d.uploadKeys??[]),value.key]);s.uploads.add(value);s.drafts.put(updated);done({draft:updated,upload:value});
      });
    }));
  }
  async function getUpload(key:string){z.uuid().parse(key);const value=await transaction<LocalUpload|null>('readonly',(s,done)=>s.get(s.uploads,key,raw=>{if(raw===undefined){done(null);return;}const v=uploadRecord.parse(raw);done(v.principalId===principalId?upload(v):null);}));return value?checkedUpload(value):null;}
  async function listUploads(){const rows=await transaction<LocalUpload[]>('readonly',(s,done)=>s.all(s.uploads.index('principalId'),principalId,raw=>{if(raw.length>uploadLimits.records)return invalid();done(raw.map(upload));}));return Promise.all(rows.map(checkedUpload));}
  async function loadUploads(input:DraftContext){const c=context(input);return Promise.all((await transaction<LocalUpload[]>('readonly',(s,done)=>s.get(s.drafts,contextKey(c),raw=>{const d=draft(raw,c);if(!d){done([]);return;}selected(s,d,done);}))).map(checkedUpload));}
  function changeUploadSelection(input:DraftContext,expectedRevision:number,key:string,select:boolean){
    const c=context(input);z.uuid().parse(key);
    return transaction<LocalDraft>('readwrite',(s,done)=>editable(s,c,expectedRevision,d=>s.get(s.uploads,key,raw=>{
      const v=upload(raw),keys=d.uploadKeys??[],included=keys.includes(key);
      if(select&&(included||keys.length>=3))throw new WorkbenchLocalError('UPLOAD_LIMIT');if(!select&&!included)throw new WorkbenchLocalError('LOCAL_CONFLICT');
      if(select&&(v.bytes===null&&v.receipt?.status!=='SUCCEEDED'||v.attachment?.state==='REMOVED'||v.receipt?.status==='FAILED'))throw new WorkbenchLocalError('UPLOAD_NOT_READY');
      const updated=withSelection(d,select?[...keys,key]:keys.filter(k=>k!==key));s.drafts.put(updated);done(updated);
    })));
  }
  function selectUpload(input:DraftContext,expectedRevision:number,key:string){return changeUploadSelection(input,expectedRevision,key,true);}
  function unlinkUpload(input:DraftContext,expectedRevision:number,key:string){return changeUploadSelection(input,expectedRevision,key,false);}
  function observeUpload(key:string,input:z.input<typeof inputOperation>|z.input<typeof uploadResponse>){
    z.uuid().parse(key);const response=uploadResponse.safeParse(input),receipt=response.success?inputOperation.parse({operationId:response.data.operationId,status:'SUCCEEDED',result:{attachmentId:response.data.attachment.attachmentId}}):inputOperation.parse(input);
    return transaction<LocalUpload>('readwrite',(s,done)=>s.get(s.uploads,key,raw=>{
      const old=upload(raw);
      if(response.success&&(response.data.attachment.state!=='READY'||response.data.attachment.clientAttachmentId!==old.envelope.metadata.clientAttachmentId||response.data.attachment.name!==old.envelope.metadata.name||response.data.attachment.byteSize!==old.envelope.byteSize))return invalid();
      if(old.receipt&&(old.receipt.operationId!==receipt.operationId||['SUCCEEDED','FAILED'].includes(old.receipt.status)&&stable(old.receipt)!==stable(receipt)))return invalid();
      if(stable(old.receipt)===stable(receipt)){done(old);return;}
      const value=upload({...old,receipt,observedAt:new Date().toISOString(),revision:old.revision+1});s.uploads.put(value);done(value);
    }));
  }
  function verifyUpload(key:string,expectedRevision:number,input:z.input<typeof attachmentView>){
    z.uuid().parse(key);revision.parse(expectedRevision);const value=attachmentView.parse(input);
    return transaction<LocalUpload>('readwrite',(s,done)=>s.get(s.uploads,key,raw=>{
      const old=upload(raw);if(old.revision!==expectedRevision)throw new WorkbenchLocalError('LOCAL_CONFLICT');if(old.receipt?.status!=='SUCCEEDED')throw new WorkbenchLocalError('UPLOAD_NOT_READY');
      if(old.attachment&&(old.attachment.createdAt!==value.createdAt||old.attachment.state==='REMOVED'&&value.state!=='REMOVED'))return invalid();
      const updated=upload({...old,attachment:value,verifiedAt:new Date().toISOString(),revision:old.revision+1});s.uploads.put(updated);done(updated);
    }));
  }
  async function releaseUpload(key:string,expectedRevision:number){
    const snapshot=await getUpload(key);if(!snapshot)return invalid();revision.parse(expectedRevision);
    return transaction<LocalUpload>('readwrite',(s,done)=>s.get(s.uploads,key,raw=>{
      const old=upload(raw);if(old.revision!==expectedRevision||!sameUpload(old,snapshot))throw new WorkbenchLocalError('LOCAL_CONFLICT');
      if(old.receipt?.status!=='SUCCEEDED'&&old.receipt?.status!=='FAILED')throw new WorkbenchLocalError('UPLOAD_NOT_READY');
      if(old.bytes===null){done(old);return;}
      const value=upload({...old,bytes:null,releasedAt:new Date().toISOString(),revision:old.revision+1});s.uploads.put(value);done(value);
    }));
  }
  return {load,getPending,references,save,enqueue,getCommand,observe,closeStale,closeRemoved,startBlankInput,closedHistory,addUpload,getUpload,listUploads,loadUploads,selectUpload,unlinkUpload,observeUpload,verifyUpload,releaseUpload,close};
}
