import {useState} from 'react';
import {workspaceView,inputOperationLookup,attachmentView} from '@devmesh/contracts';
import {staleOriginalProof,removedOriginalProof} from './workbench-local.js';
import type {LocalCommand} from './workbench-local.js';
import type {WorkbenchRead} from './workbench-api.js';

/** Read a newer exact Run before testing absence: the reverse order is unsafe. */
export async function verifyStaleOriginal(command:LocalCommand,read:WorkbenchRead){
 const c=command.envelope.context;
 if(c.form==='project'||command.receipt||command.closure)throw Error('Original is not eligible for stale-basis closure');
 const workspace=workspaceView.parse(await read('/api/v1/projects/'+encodeURIComponent(c.projectId)+'/workspace?runId='+encodeURIComponent(c.runId)+'&limit=1'));
 if(workspace.project.projectId!==c.projectId||workspace.run.projectId!==c.projectId||workspace.run.runId!==c.runId||workspace.membership==='viewer'||workspace.mode!=='current'||workspace.run.resourceRevision<=c.basisRevision)throw Error('No authorized newer exact Run');
 const workspaceReadAt=new Date().toISOString();
 const lookup=inputOperationLookup.parse(await read('/api/v1/operations/lookup?scope='+encodeURIComponent(command.envelope.scope)+'&key='+command.key+'&includeAbsence=true'));
 if(lookup.principalId!==c.principalId||lookup.scope!==command.envelope.scope||lookup.key!==command.key)throw Error('Original lookup identity differs');
 if(lookup.operation!==null)return {kind:'operation' as const,value:lookup.operation};
 return {kind:'absent' as const,proof:staleOriginalProof.parse({reason:'STALE_BASIS',key:command.key,projectId:c.projectId,runId:c.runId,resourceRevision:workspace.run.resourceRevision,workspaceReadAt,lookupReadAt:new Date().toISOString(),lookup})};
}

export function CloseOriginal({busy,onClose}:{busy:boolean;onClose:()=>void}){
 const [agreed,setAgreed]=useState(false);
 return <div className="notice" aria-label="关闭过期原提交"><p>若原条件已过期，可核实后关闭待核实状态。原内容继续保留，采用新依据需要重新审阅。</p><label><input type="checkbox" disabled={busy} checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>我确认关闭已过期的原提交，保留原内容</label><button disabled={busy||!agreed} onClick={()=>{setAgreed(false);onClose();}}>核实并关闭过期原提交</button></div>;
}

/** A permanent removal must be observed before positive absence of this exact original. */
export async function verifyRemovedOriginal(command:LocalCommand,read:WorkbenchRead){
 const e=command.envelope,attachmentIds=e.kind==='project'?e.body.initialRequest.attachmentIds:e.kind==='message'?e.body.attachmentIds:[];
 if(command.receipt||command.closure||!attachmentIds.length)throw Error('Original is not eligible for removed-attachment closure');
 for(const id of attachmentIds){
  const attachment=attachmentView.parse(await read('/api/v1/attachments/'+encodeURIComponent(id)));
  if(attachment.attachmentId!==id)throw Error('Original attachment identity differs');
  if(attachment.state!=='REMOVED')continue;
  const attachmentReadAt=new Date().toISOString(),lookup=inputOperationLookup.parse(await read('/api/v1/operations/lookup?scope='+encodeURIComponent(e.scope)+'&key='+encodeURIComponent(command.key)+'&includeAbsence=true'));
  if(lookup.principalId!==e.context.principalId||lookup.scope!==e.scope||lookup.key!==command.key)throw Error('Original lookup identity differs');
  if(lookup.operation!==null)return {kind:'operation' as const,value:lookup.operation};
  return {kind:'absent' as const,proof:removedOriginalProof.parse({reason:'REMOVED_ATTACHMENT',key:command.key,attachment,attachmentReadAt,lookupReadAt:new Date().toISOString(),lookup})};
 }
 throw Error('No original attachment is permanently removed');
}

export function CloseRemovedOriginal({busy,onClose}:{busy:boolean;onClose:()=>void}){
 const [agreed,setAgreed]=useState(false);
 return <div className="notice" aria-label="关闭附件已移除的原提交"><p>若原提交中的附件已移除，可核实并关闭待核实状态。原内容仍保留。</p><label><input type="checkbox" disabled={busy} checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>我确认关闭因附件移除而无法提交的原请求，保留原内容</label><button disabled={busy||!agreed} onClick={()=>{setAgreed(false);onClose();}}>核实附件移除并关闭原提交</button></div>;
}
