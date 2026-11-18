import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {conversationDelete,conversationDeletionState,inputOperation} from '@devmesh/contracts';
import type {ConversationSummary} from '@devmesh/contracts';
import type {z} from 'zod';
import {openConversationLocal} from './conversation-local.js';
import type {ConversationDeleteOriginal} from './conversation-local.js';
import {WorkbenchApiError} from './workbench-api.js';

type Api=(path:string,init?:RequestInit)=>Promise<unknown>;
type DeletionState=z.output<typeof conversationDeletionState>;
const reasonText={ACTIVE:'这条任务仍在处理中。请先打开任务并暂停，待暂停完成后再删除。',UNRESOLVED:'这条任务还有待核实的处理或执行结果，请先打开任务核实。',READ_ONLY:'当前任务为只读，不能删除。'};
function DeleteDialog({title,state,problem,busy,disabled,onConfirm,onClose,onOpen}:{title:string;state:DeletionState|null;problem:string;busy:boolean;disabled:boolean;onConfirm:()=>void;onClose:()=>void;onOpen:()=>void}){
 const dialog=useRef<HTMLDialogElement|null>(null),cancel=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{dialog.current?.showModal();cancel.current?.focus();return()=>dialog.current?.close();},[]);
 return <dialog ref={dialog} className="modal conversation-delete-dialog" aria-labelledby="delete-conversation-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}><h2 id="delete-conversation-title">删除任务？</h2><p className="delete-task-name">{state?.title??title}</p><p>这条任务将从列表中移除，无法继续此对话。关联项目、成果和执行记录会保留，本机草稿不会自动清除。</p>{!state&&!problem&&<p role="status">正在核实任务状态…</p>}{state?.reason&&<p className="notice" role="status">{reasonText[state.reason]}</p>}{problem&&<p className="notice" role="alert">{problem}</p>}<div className="actions"><button type="button" ref={cancel} disabled={busy} onClick={onClose}>取消</button>{state?.reason&&state.reason!=='READ_ONLY'&&<button type="button" disabled={busy} onClick={onOpen}>打开任务</button>}<button type="button" className="delete-confirm" disabled={busy||disabled||!state?.canDelete} onClick={onConfirm}>{busy?'正在删除…':'删除任务'}</button></div></dialog>;
}

export function ConversationDelete({principalId,target,api,beforeDelete,onClose,onDeleted,onOpen}:{principalId:string;target:ConversationSummary|null;api:Api;beforeDelete:()=>Promise<boolean>;onClose:()=>void;onDeleted:(id:string)=>Promise<void>;onOpen:(id:string)=>Promise<void>}){
 const [state,setState]=useState<DeletionState|null>(null),[original,setOriginal]=useState<ConversationDeleteOriginal|null>(null),[busy,setBusy]=useState(false),[problem,setProblem]=useState(''),[localProblem,setLocalProblem]=useState(''),[ready,setReady]=useState(false),[notice,setNotice]=useState('');
 const store=useRef<Awaited<ReturnType<typeof openConversationLocal>>|null>(null),reader=useRef(api),selected=useRef(target),working=useRef(false);reader.current=api;selected.current=target;
 useEffect(()=>{let stopped=false;void openConversationLocal(principalId).then(async local=>{if(stopped){local.close();return;}store.current=local;const pending=await local.pendingDeletion();if(!stopped){setOriginal(pending);setReady(true);}}).catch(()=>{if(!stopped)setLocalProblem('本机记录暂时不可用，请稍后重新进入；尚未发起删除。');});return()=>{stopped=true;store.current?.close();};},[principalId]);
 async function refresh(id:string){const value=conversationDeletionState.parse(await reader.current('/api/v1/conversations/'+encodeURIComponent(id)+'/deletion-state'));if(selected.current?.conversationId===id)setState(value);}
 useEffect(()=>{setState(null);setProblem('');if(!target)return;void refresh(target.conversationId).catch(()=>{if(selected.current?.conversationId===target.conversationId)setProblem('任务不存在、权限已变化或状态暂时不可读，请重新核对。');});},[target?.conversationId]);
 async function remove(recover=false){if(working.current||!store.current||!ready)return;working.current=true;setBusy(true);let command:ConversationDeleteOriginal|null=recover?original:null;
  try{
   if(!command){if(!target||!state?.canDelete||!await beforeDelete()){setProblem('请先保存当前输入和文件，再删除任务。');return;}command=await store.current.beginDeletion(target.conversationId,state.title,conversationDelete.parse({revision:state.revision}));setOriginal(command);}
   let receipt;try{receipt=inputOperation.parse(await reader.current('/api/v1/conversation-operations/'+command.key+'?scope='+encodeURIComponent(command.conversationId)));}catch(e){if(!(e instanceof WorkbenchApiError)||e.status!==404)throw e;}
   if(!receipt){if(!await beforeDelete())throw Error('Local draft unresolved');receipt=inputOperation.parse(await reader.current('/api/v1/conversations/'+encodeURIComponent(command.conversationId)+'/deletions',{method:'POST',headers:{'content-type':'application/json','idempotency-key':command.key},body:JSON.stringify(command.body)}));}
   if(receipt.status!=='SUCCEEDED'||receipt.result?.conversationId!==command.conversationId||typeof receipt.result.deletedAt!=='string')throw Error('Deletion outcome unknown');
   await store.current.finishControl(command.key);setOriginal(null);setProblem('');setNotice('任务“'+command.title+'”已删除');onClose();try{await onDeleted(command.conversationId);}catch{setNotice('任务已删除，列表暂未刷新，请刷新页面核对。');}
  }catch(e){if(command&&e instanceof WorkbenchApiError&&['CONVERSATION_REVISION_CHANGED','CONVERSATION_ACTION_BUSY','CONVERSATION_RESULT_UNKNOWN','CONTROL_TARGETS_UNRESOLVED'].includes(e.code)){await store.current.finishControl(command.key,'FAILED');setOriginal(null);setProblem('任务状态已变化，本次删除未生效。请核对当前状态后重试。');await refresh(command.conversationId).catch(()=>{});}else if((e as {code?:string})?.code==='LOCAL_PENDING')setProblem('这条任务或另一条删除还有原请求待核实，请先核实原请求。');else if(command){setProblem('删除结果尚未确认，原请求已保存在本机。');onClose();}else setProblem('本机记录尚未保存，未发起删除。请稍后重试。');}
  finally{working.current=false;setBusy(false);}
 }
 return createPortal(<>{target&&<DeleteDialog title={target.title} state={state} problem={localProblem||problem} busy={busy} disabled={!ready||!!original} onConfirm={()=>void remove()} onClose={onClose} onOpen={()=>{const id=target.conversationId;onClose();void onOpen(id);}}/>}{original&&!target&&<div className="task-delete-feedback notice" role="status"><p>任务“{original.title}”的删除结果待核实。</p><button disabled={busy} onClick={()=>void remove(true)}>核实原删除请求</button></div>}{notice&&!original&&<div className="task-delete-feedback" role="status"><p>{notice}</p><button aria-label="关闭删除提示" onClick={()=>setNotice('')}>×</button></div>}</>,document.body);
}
