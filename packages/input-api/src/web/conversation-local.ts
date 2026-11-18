import type {z} from 'zod';
import type {conversationMode,conversationInput,conversationConfirm,conversationRename,conversationDelete} from '@devmesh/contracts';
import {prepareUpload} from './workbench-upload.js';
export type Mode=z.output<typeof conversationMode>;
export interface ConversationDraft {key:string;owner:string;revision:number;text:string;mode:Mode;files:string[];pending:string|null}
export interface ConversationFile {id:string;owner:string;spaceId?:string;name:string;mime:string;bytes:ArrayBuffer|null;size:number;contentHash:string;uploadKey:string;clientAttachmentId:string;attachmentId:string|null}
export interface ConversationCommand {key:string;owner:string;scope:string;spaceId?:string;conversationId:string|null;createKey:string;clientConversationId:string;clientMessageId:string;text:string;mode:Mode;files:string[];draftRevision:number;body:z.output<typeof conversationInput>|null;state:'PENDING'|'SUCCEEDED'}
export interface ConversationControlOriginal {key:string;owner:string;conversationId:string;body:{action:'PAUSE'|'RESUME'|'CANCEL'|'RECONCILE';revision:number};state:'PENDING'|'SUCCEEDED'|'FAILED'}
export type ConversationUiCommand=({kind:'CONFIRM';body:z.output<typeof conversationConfirm>}|{kind:'RENAME';body:z.output<typeof conversationRename>})&{key:string;owner:string;conversationId:string;state:'PENDING'|'SUCCEEDED'|'FAILED'};
export interface ConversationDeleteOriginal {kind:'DELETE';key:string;owner:string;conversationId:string;title:string;body:z.output<typeof conversationDelete>;state:'PENDING'|'SUCCEEDED'|'FAILED'}
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const error=(code:string)=>Object.assign(Error(code),{code});
export async function openConversationLocal(owner:string){
 const opening=indexedDB.open('devmesh.conversations',1);
 opening.onupgradeneeded=()=>{for(const name of ['drafts','files','commands','controls'])if(!opening.result.objectStoreNames.contains(name))opening.result.createObjectStore(name,{keyPath:name==='drafts'?'key':name==='files'?'id':'key'});};
 const db=await request(opening);
 async function tx<T>(names:string[],mode:IDBTransactionMode,work:(stores:Record<string,IDBObjectStore>)=>Promise<T>):Promise<T>{
  const t=db.transaction(names,mode),stores=Object.fromEntries(names.map(n=>[n,t.objectStore(n)]));
  const done=new Promise<void>((resolve,reject)=>{t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error??error('LOCAL_SAVE_FAILED'));t.onerror=()=>{};});
  try{const value=await work(stores);await done;return value;}catch(e){try{t.abort();}catch{/* Already aborted. */}await done.catch(()=>{});throw e;}
 }
 const empty=(scope:string):ConversationDraft=>({key:owner+'|'+scope,owner,revision:0,text:'',mode:'EXECUTE',files:[],pending:null});
 async function load(scope:string){return tx(['drafts'],'readonly',async s=>await request(s.drafts!.get(owner+'|'+scope)) as ConversationDraft|undefined??empty(scope));}
 async function update(scope:string,expected:number,patch:Partial<Pick<ConversationDraft,'text'|'mode'|'files'>>){return tx(['drafts'],'readwrite',async s=>{const d=await request(s.drafts!.get(owner+'|'+scope)) as ConversationDraft|undefined??empty(scope);if(d.revision!==expected)throw error('LOCAL_CONFLICT');const next={...d,...patch,revision:d.revision+1};s.drafts!.put(next);return next;});}
 async function files(ids:string[]){return tx(['files'],'readonly',async s=>{const result:ConversationFile[]=[];for(const id of ids){const f=await request(s.files!.get(id)) as ConversationFile|undefined;if(!f||f.owner!==owner)throw error('LOCAL_ORIGINAL_MISSING');result.push(f);}return result;});}
 async function addFile(scope:string,expected:number,file:File,spaceId?:string){
  const original=await prepareUpload(owner,file),bytes=new Uint8Array(original.bytes!).buffer;
  return tx(['drafts','files'],'readwrite',async s=>{const d=await request(s.drafts!.get(owner+'|'+scope)) as ConversationDraft|undefined??empty(scope);if(d.revision!==expected)throw error('LOCAL_CONFLICT');if(d.files.length>=3)throw error('UPLOAD_LIMIT');
   const existing=await request(s.files!.getAll()) as ConversationFile[];if(existing.filter(f=>f.owner===owner&&f.bytes!==null).length>=20)throw error('LOCAL_FILE_LIMIT');
   const id=crypto.randomUUID(),f:ConversationFile={id,owner,name:original.envelope.metadata.name,mime:original.envelope.mime,bytes,size:file.size,contentHash:original.envelope.contentHash,uploadKey:original.key,clientAttachmentId:original.envelope.metadata.clientAttachmentId,attachmentId:null};
   if(spaceId)f.spaceId=spaceId;s.files!.put(f);const next={...d,files:[...d.files,id],revision:d.revision+1};s.drafts!.put(next);return next;
  });
 }
 async function unlink(scope:string,expected:number,id:string){return tx(['drafts'],'readwrite',async s=>{const d=await request(s.drafts!.get(owner+'|'+scope)) as ConversationDraft|undefined??empty(scope);if(d.revision!==expected)throw error('LOCAL_CONFLICT');const next={...d,files:d.files.filter(x=>x!==id),revision:d.revision+1};s.drafts!.put(next);return next;});}
 async function begin(scope:string,expected:number,conversationId:string|null,spaceId?:string){return tx(['drafts','commands'],'readwrite',async s=>{const d=await request(s.drafts!.get(owner+'|'+scope)) as ConversationDraft|undefined??empty(scope);if(d.revision!==expected)throw error('LOCAL_CONFLICT');if(d.pending)throw error('LOCAL_PENDING');
  const command:ConversationCommand={key:crypto.randomUUID(),owner,scope,conversationId,createKey:crypto.randomUUID(),clientConversationId:crypto.randomUUID(),clientMessageId:crypto.randomUUID(),text:d.text,mode:d.mode,files:[...d.files],draftRevision:d.revision,body:null,state:'PENDING'};
  if(spaceId)command.spaceId=spaceId;s.commands!.put(command);s.drafts!.put({...d,pending:command.key});return command;
 });}
 async function command(key:string){return tx(['commands'],'readonly',async s=>{const c=await request(s.commands!.get(key)) as ConversationCommand|undefined;if(!c||c.owner!==owner)throw error('LOCAL_ORIGINAL_MISSING');return c;});}
 async function patchCommand(key:string,patch:Partial<Pick<ConversationCommand,'conversationId'|'body'>>){return tx(['commands'],'readwrite',async s=>{const c=await request(s.commands!.get(key)) as ConversationCommand|undefined;if(!c||c.owner!==owner)throw error('LOCAL_ORIGINAL_MISSING');if(c.body&&patch.body&&JSON.stringify(c.body)!==JSON.stringify(patch.body))throw error('LOCAL_CONFLICT');const next={...c,...patch};s.commands!.put(next);return next;});}
 async function uploaded(id:string,attachmentId:string){return tx(['files'],'readwrite',async s=>{const f=await request(s.files!.get(id)) as ConversationFile|undefined;if(!f||f.owner!==owner)throw error('LOCAL_ORIGINAL_MISSING');if(f.attachmentId&&f.attachmentId!==attachmentId)throw error('LOCAL_CONFLICT');s.files!.put({...f,attachmentId});});}
 async function finish(key:string){return tx(['drafts','commands'],'readwrite',async s=>{const c=await request(s.commands!.get(key)) as ConversationCommand|undefined;if(!c||c.owner!==owner||!c.conversationId)throw error('LOCAL_ORIGINAL_MISSING');if(c.state==='SUCCEEDED')return await request(s.drafts!.get(owner+'|'+c.conversationId)) as ConversationDraft|undefined??empty(c.conversationId);
  const d=await request(s.drafts!.get(owner+'|'+c.scope)) as ConversationDraft|undefined;if(!d||d.pending!==key)throw error('LOCAL_CONFLICT');
  let next={...d,pending:null,text:d.text===c.text?'':d.text,files:d.files.filter(id=>!c.files.includes(id)),revision:d.revision+1};
  const target=owner+'|'+c.conversationId;
  if(target!==d.key){if(await request(s.drafts!.get(target)))throw error('LOCAL_CONFLICT');s.drafts!.delete(d.key);next={...next,key:target};}
  s.drafts!.put(next);s.commands!.put({...c,state:'SUCCEEDED'});return next;
 });}
 async function library(spaceId?:string){return tx(['files'],'readonly',async s=>(await request(s.files!.getAll()) as ConversationFile[]).filter(f=>f.owner===owner&&(!spaceId||f.spaceId===spaceId)));}
 async function migrateSpaces(legacySpaceId:string){return tx(['drafts','files'],'readwrite',async s=>{const old=await request(s.drafts!.get(owner+'|new')) as ConversationDraft|undefined,target=owner+'|new:'+legacySpaceId;if(old&&!old.pending&&!await request(s.drafts!.get(target))){s.drafts!.put({...old,key:target});/* Pending originals keep their original scope and body. */if(!old.pending)s.drafts!.delete(old.key);}for(const f of await request(s.files!.getAll()) as ConversationFile[])if(f.owner===owner&&!f.spaceId)s.files!.put({...f,spaceId:legacySpaceId});});}
 async function tagTaskFiles(conversationId:string,spaceId:string){return tx(['drafts','files','commands'],'readwrite',async s=>{const d=await request(s.drafts!.get(owner+'|'+conversationId)) as ConversationDraft|undefined,commands=await request(s.commands!.getAll()) as ConversationCommand[],ids=new Set([...(d?.files??[]),...commands.filter(c=>c.owner===owner&&c.conversationId===conversationId).flatMap(c=>c.files)]);for(const id of ids){const f=await request(s.files!.get(id)) as ConversationFile|undefined;if(f?.owner===owner)s.files!.put({...f,spaceId});}});}
 async function release(id:string){return tx(['files','drafts','commands'],'readwrite',async s=>{const f=await request(s.files!.get(id)) as ConversationFile|undefined;if(!f||f.owner!==owner||!f.attachmentId)throw error('LOCAL_RESULT_UNKNOWN');const drafts=await request(s.drafts!.getAll()) as ConversationDraft[],commands=await request(s.commands!.getAll()) as ConversationCommand[];if(drafts.some(d=>d.owner===owner&&d.files.includes(id))||commands.some(c=>c.owner===owner&&c.state==='PENDING'&&c.files.includes(id)))throw error('LOCAL_PENDING');s.files!.put({...f,bytes:null});});}
 async function pendingControl(conversationId:string){return tx(['controls'],'readonly',async s=>(await request(s.controls!.getAll()) as ConversationControlOriginal[]).find(c=>!('kind' in c)&&c.owner===owner&&c.conversationId===conversationId&&c.state==='PENDING')??null);}
 async function beginControl(conversationId:string,body:ConversationControlOriginal['body']){return tx(['controls'],'readwrite',async s=>{const old=(await request(s.controls!.getAll()) as ConversationControlOriginal[]).find(c=>!('kind' in c)&&c.owner===owner&&c.conversationId===conversationId&&c.state==='PENDING');if(old)return old;const c:ConversationControlOriginal={key:crypto.randomUUID(),owner,conversationId,body,state:'PENDING'};s.controls!.put(c);return c;});}
 async function finishControl(key:string,state:'SUCCEEDED'|'FAILED'='SUCCEEDED'){return tx(['controls'],'readwrite',async s=>{const c=await request(s.controls!.get(key)) as ConversationControlOriginal|undefined;if(!c||c.owner!==owner)throw error('LOCAL_ORIGINAL_MISSING');s.controls!.put({...c,state});});}
 async function pendingUi(conversationId:string){return tx(['controls'],'readonly',async s=>(await request(s.controls!.getAll()) as ConversationUiCommand[]).find(c=>['CONFIRM','RENAME'].includes(c.kind)&&c.owner===owner&&c.conversationId===conversationId&&c.state==='PENDING')??null);}
 async function beginUi(conversationId:string,command:Pick<Extract<ConversationUiCommand,{kind:'RENAME'}>,'kind'|'body'>|Pick<Extract<ConversationUiCommand,{kind:'CONFIRM'}>,'kind'|'body'>){return tx(['controls'],'readwrite',async s=>{const old=(await request(s.controls!.getAll()) as ConversationUiCommand[]).find(c=>c.owner===owner&&c.conversationId===conversationId&&c.state==='PENDING');if(old)throw error('LOCAL_PENDING');const next:ConversationUiCommand={...command,key:crypto.randomUUID(),owner,conversationId,state:'PENDING'};s.controls!.put(next);return next;});}
 async function pendingDeletion(){return tx(['controls'],'readonly',async s=>(await request(s.controls!.getAll()) as ConversationDeleteOriginal[]).find(c=>c.kind==='DELETE'&&c.owner===owner&&c.state==='PENDING')??null);}
 async function beginDeletion(conversationId:string,title:string,body:ConversationDeleteOriginal['body']){return tx(['controls','drafts'],'readwrite',async s=>{const records=await request(s.controls!.getAll()) as (ConversationControlOriginal|ConversationUiCommand|ConversationDeleteOriginal)[];
  if(records.some(c=>c.owner===owner&&c.state==='PENDING'&&(c.conversationId===conversationId||'kind' in c&&c.kind==='DELETE')))throw error('LOCAL_PENDING');
  const draft=await request(s.drafts!.get(owner+'|'+conversationId)) as ConversationDraft|undefined;if(draft?.pending)throw error('LOCAL_PENDING');
  const next:ConversationDeleteOriginal={kind:'DELETE',key:crypto.randomUUID(),owner,conversationId,title,body,state:'PENDING'};s.controls!.put(next);return next;
 });}
 return {load,update,files,addFile,unlink,begin,command,patchCommand,uploaded,finish,library,release,migrateSpaces,tagTaskFiles,pendingControl,beginControl,finishControl,pendingUi,beginUi,pendingDeletion,beginDeletion,close:()=>db.close()};
}
