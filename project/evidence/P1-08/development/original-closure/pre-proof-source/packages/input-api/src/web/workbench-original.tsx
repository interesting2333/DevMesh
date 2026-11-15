import {useState} from 'react';
import {workspaceView} from '@devmesh/contracts';
import {staleOriginalProof} from './workbench-local.js';
import type {LocalCommand} from './workbench-local.js';
import type {WorkbenchRead} from './workbench-api.js';
import {WorkbenchApiError} from './workbench-api.js';

/** Read a newer exact Run before testing absence: the reverse order is unsafe. */
export async function verifyStaleOriginal(command:LocalCommand,read:WorkbenchRead){
 const c=command.envelope.context;
 if(c.form==='project'||command.receipt||command.closure)throw Error('Original is not eligible for stale-basis closure');
 const workspace=workspaceView.parse(await read('/api/v1/projects/'+encodeURIComponent(c.projectId)+'/workspace?runId='+encodeURIComponent(c.runId)+'&limit=1'));
 if(workspace.project.projectId!==c.projectId||workspace.run.projectId!==c.projectId||workspace.run.runId!==c.runId||workspace.membership==='viewer'||workspace.mode!=='current'||workspace.run.resourceRevision<=c.basisRevision)throw Error('No authorized newer exact Run');
 const workspaceReadAt=new Date().toISOString();
 try{return {kind:'operation' as const,value:await read('/api/v1/operations/lookup?scope='+encodeURIComponent(command.envelope.scope)+'&key='+command.key)};}
 catch(e){if(!(e instanceof WorkbenchApiError)||e.status!==404||e.code!=='RESOURCE_NOT_FOUND')throw e;}
 return {kind:'absent' as const,proof:staleOriginalProof.parse({reason:'STALE_BASIS',key:command.key,projectId:c.projectId,runId:c.runId,resourceRevision:workspace.run.resourceRevision,workspaceReadAt,lookupReadAt:new Date().toISOString()})};
}

export function CloseOriginal({busy,onClose}:{busy:boolean;onClose:()=>void}){
 const [agreed,setAgreed]=useState(false);
 return <div className="notice" aria-label="关闭过期原提交"><p>若原条件已过期，可核实后关闭待核实状态。原内容继续保留，采用新依据需要重新审阅。</p><label><input type="checkbox" disabled={busy} checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>我确认关闭已过期的原提交，保留原内容</label><button disabled={busy||!agreed} onClick={()=>{setAgreed(false);onClose();}}>核实并关闭过期原提交</button></div>;
}
