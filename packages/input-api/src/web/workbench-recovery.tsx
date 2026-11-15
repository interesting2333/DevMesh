import {useEffect,useRef,useState} from 'react';
import type {MutableRefObject} from 'react';
import type {z} from 'zod';
import type {workspaceView} from '@devmesh/contracts';
import {openWorkbenchLocal} from './workbench-local.js';
import type {LocalCommand} from './workbench-local.js';
import {WorkbenchApiError} from './workbench-api.js';
import type {WorkbenchRead,WorkbenchCommand} from './workbench-api.js';
import {CloseOriginal,verifyStaleOriginal} from './workbench-original.js';

type Form='message'|'plan-confirm'|'questions-answer';
type Store=Awaited<ReturnType<typeof openWorkbenchLocal>>;
const labels={message:{title:'原消息提交恢复',lookup:'核实原提交',retry:'使用原请求继续提交'},'plan-confirm':{title:'原计划确认恢复',lookup:'核实原计划确认',retry:'使用原请求继续确认计划'},'questions-answer':{title:'原回答提交恢复',lookup:'核实原回答提交',retry:'使用原请求继续提交回答'}};

/** Existing originals only: this component never saves a draft or enqueues a command. */
export function WorkbenchRecovery({principalId,workspace,form,read,write,guard,onChanged}:{principalId:string;workspace:z.output<typeof workspaceView>;form:Form;read:WorkbenchRead;write:WorkbenchCommand;guard:MutableRefObject<()=>Promise<boolean>>;onChanged:(result?:string)=>Promise<void>}){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState<LocalCommand|null>(null),[notice,setNotice]=useState(''),[problem,setProblem]=useState('');
 const store=useRef<Store|null>(null),original=useRef<LocalCommand|null>(null),working=useRef(false),disposed=useRef(false),scope={principalId,projectId:workspace.project.projectId,runId:workspace.run.runId,form};
 async function load(){
  const local=await openWorkbenchLocal(principalId);if(disposed.current){local.close();return;}
  try{const value=await local.getPending(scope);if(disposed.current){local.close();return;}store.current?.close();store.current=local;original.current=value;setPending(value);setProblem('');setReady(true);}
  catch(e){local.close();throw e;}
 }
 useEffect(()=>{disposed.current=false;guard.current=async()=>!working.current;void load().catch(()=>{if(!disposed.current){setReady(true);setProblem('本机原提交记录暂不可读，请重新读取。原请求未重发。');}});return()=>{disposed.current=true;guard.current=async()=>true;store.current?.close();};},[]);
 async function exclusive(work:()=>Promise<void>){if(working.current||disposed.current)return;working.current=true;setBusy(true);setProblem('');try{await work();}catch{if(!disposed.current)setProblem('原请求尚未核实，记录继续保留。请检查当前权限或重新读取。');}finally{working.current=false;if(!disposed.current)setBusy(false);}}
 async function refreshAfterCommit(result:string){working.current=false;try{await onChanged(result);}catch{if(!disposed.current)setProblem('原结果已保存在本机，当前页面尚未刷新，请重新进入。');}}
 async function observe(command:LocalCommand,value:unknown){
  const result=await store.current!.observe(command.key,value as Parameters<Store['observe']>[1]);if(disposed.current)return;
  if(result.receipt?.status!=='SUCCEEDED'){original.current=result;setPending(result);setNotice('原操作仍待核实，请保留原记录。');return;}
  original.current=null;setPending(null);setNotice('');await refreshAfterCommit('已核实原请求成功并保存回执；后续执行结果另行核实。');
 }
 async function lookup(){const p=original.current;if(!p)return;try{await observe(p,await read('/api/v1/operations/lookup?scope='+encodeURIComponent(p.envelope.scope)+'&key='+p.key));}catch(e){if(e instanceof WorkbenchApiError&&e.status===404){setProblem('当前未查到原操作，原记录继续保留；可核实或明确重试同一原请求。');return;}throw e;}}
 async function retry(){const p=original.current;if(!p)return;const e=p.envelope;if(e.kind==='project'||e.kind!==form)throw Error('Wrong original form');await observe(p,await write(e.path,{method:'POST',headers:{'content-type':'application/json','idempotency-key':e.key,'if-match':e.ifMatch},body:JSON.stringify(e.body)}));}
 async function closeOriginal(){const p=original.current;if(!p)return;let committed=false;try{const v=await verifyStaleOriginal(p,read);if(v.kind==='operation'){await observe(p,v.value);return;}await store.current!.closeStale(p,v.proof);committed=true;original.current=null;setPending(null);setNotice('');await refreshAfterCommit('过期原请求已核实关闭，原内容与依据保留。');}catch{if(!disposed.current)setProblem(committed?'关闭已保存在本机，当前页面尚未刷新，请重新进入。':'尚不能关闭原请求。请核实当前权限、执行依据及原操作；原记录继续保留。');}}
 if(!ready||!pending&&!notice&&!problem)return null;
 const text=labels[form];return <section className="notice" aria-label={text.title}><h3>{text.title}</h3>{notice&&<p role="status">{notice}</p>}{problem&&<p role="alert">{problem}</p>}{pending&&<><p>当前新提交入口不可用。这里只恢复已保存的原请求；刷新不会自动发送。</p><div className="actions"><button disabled={busy} onClick={()=>void exclusive(lookup)}>{text.lookup}</button><button disabled={busy} onClick={()=>void exclusive(retry)}>{text.retry}</button></div><details><summary>查看原内容与依据</summary><p>原执行依据版本 {pending.envelope.context.basisRevision}</p><pre className="source-text">{pending.envelope.kind==='message'?pending.envelope.body.text:JSON.stringify(pending.envelope.body,null,2)}</pre></details><CloseOriginal key={pending.key} busy={busy} onClose={()=>void exclusive(closeOriginal)}/></>}{problem&&<button disabled={busy} onClick={()=>void exclusive(load)}>重新读取本机原提交</button>}</section>;
}
