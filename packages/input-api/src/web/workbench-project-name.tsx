import {useState} from 'react';
import {z} from 'zod';
import {ids,opaqueKey,renameProjectInput,inputOperation,workspaceView} from '@devmesh/contracts';
import {WorkbenchApiError} from './workbench-api.js';

const original=z.strictObject({version:z.literal(1),principalId:opaqueKey,projectId:ids.project,key:z.uuid(),body:renameProjectInput});
type Original=z.output<typeof original>;
type Api=(path:string,init?:RequestInit)=>Promise<unknown>;

/** A title edit has its own immutable retry record; it never changes a task basis. */
export function WorkbenchProjectName({principalId,projectId,name,api,onRenamed}:{principalId:string;projectId:string;name:string;api:Api;onRenamed:(name:string)=>void}){
 const [open,setOpen]=useState(false),[value,setValue]=useState(name),[pending,setPending]=useState<Original|null>(null),[busy,setBusy]=useState(false),[problem,setProblem]=useState(''),[unreadable,setUnreadable]=useState(false),[rejected,setRejected]=useState(false);
 const storageKey='devmesh.workbench.rename.v1:'+JSON.stringify([principalId,projectId]);
 function show(){
  setValue(name);setProblem('');setRejected(false);setUnreadable(false);setPending(null);
  try{const raw=sessionStorage.getItem(storageKey);if(raw!==null){if(raw.length>2048)throw Error('Record too large');const p=original.parse(JSON.parse(raw));if(p.principalId!==principalId||p.projectId!==projectId)throw Error('Wrong scope');setPending(p);setValue(p.body.name);}}
  catch{setUnreadable(true);setProblem('重命名记录暂不可读，请刷新后重试；当前任务和草稿仍保留。');}
  setOpen(true);
 }
 async function save(){
  if(busy||unreadable||rejected)return;setBusy(true);setProblem('');let recorded=false;
  try{
   const p=pending??original.parse({version:1,principalId,projectId,key:crypto.randomUUID(),body:{name:value.trim(),previousName:name}});
   sessionStorage.setItem(storageKey,JSON.stringify(p));recorded=true;setPending(p);
   const result=inputOperation.parse(await api('/api/v1/projects/'+encodeURIComponent(projectId)+'/name',{method:'PUT',headers:{'content-type':'application/json','idempotency-key':p.key},body:JSON.stringify(p.body)}));
   const renamed=z.strictObject({projectId:ids.project,name:z.string()}).parse(result.result);
   if(result.status!=='SUCCEEDED'||renamed.projectId!==projectId||renamed.name!==p.body.name)throw Error('Unconfirmed rename');
   sessionStorage.removeItem(storageKey);setPending(null);onRenamed(renamed.name);setOpen(false);
  }catch(error){
   const conflict=error instanceof WorkbenchApiError&&error.code==='PROJECT_NAME_CHANGED';setRejected(conflict);
   setProblem(!recorded?'本机记录未能保存，尚未发送重命名。请重试。':conflict?'项目名称已被修改。请重新读取当前名称后再编辑。':'重命名尚未确认。记录已保留，可使用同一请求重试；当前任务和草稿不受影响。');
  }finally{setBusy(false);}
 }
 async function reread(){
  if(busy||!rejected)return;setBusy(true);
  try{const current=workspaceView.parse(await api('/api/v1/projects/'+encodeURIComponent(projectId)+'/workspace?limit=1'));if(current.project.projectId!==projectId)throw Error('Wrong project');sessionStorage.removeItem(storageKey);setPending(null);setRejected(false);setValue(current.project.name);setProblem('');onRenamed(current.project.name);}
  catch{setProblem('暂时无法重新读取，请稍后重试；原重命名记录继续保留。');}finally{setBusy(false);}
 }
 return <><button type="button" className="rename-project" aria-label="重命名项目" title="重命名项目" onClick={show}>重命名</button>{open&&<div className="modal-backdrop" onClick={()=>{if(!busy)setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();if(!busy)setOpen(false);}}}><section className="modal" role="dialog" aria-modal="true" aria-label="重命名项目" onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>重命名项目</h2><button type="button" disabled={busy} aria-label="关闭重命名" onClick={()=>setOpen(false)}>关闭</button></div><form onSubmit={e=>{e.preventDefault();void save();}}><label htmlFor="rename-project-name">项目名称</label><input id="rename-project-name" autoFocus maxLength={80} value={value} disabled={busy||pending!==null||unreadable} onChange={e=>setValue(e.target.value)}/>{pending&&<p className="muted">有一份重命名结果待确认，继续保存将使用同一请求。</p>}{problem&&<p className="notice" role="alert">{problem}</p>}<div className="actions">{rejected?<button type="button" disabled={busy} onClick={()=>void reread()}>重新读取名称</button>:<button className="primary" type="submit" disabled={busy||unreadable||!value.trim()||!pending&&value.trim()===name}>{busy?'保存中…':pending?'使用原请求重试':'保存名称'}</button>}</div></form></section></div>}</>;
}
