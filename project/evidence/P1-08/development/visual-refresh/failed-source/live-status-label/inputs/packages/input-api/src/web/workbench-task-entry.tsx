import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {openWorkbenchLocal} from './workbench-local.js';
import type {DraftContext,LocalCommand} from './workbench-local.js';
import type {z} from 'zod';
import type {workspaceView} from '@devmesh/contracts';

type TaskContext=Extract<DraftContext,{form:'task'}>;
export function WorkbenchTaskEntry({principalId,workspace,before,normal,children}:{principalId:string;workspace:z.output<typeof workspaceView>;before:()=>Promise<boolean>;normal:ReactNode;children:(context:TaskContext,canSubmit:boolean)=>ReactNode}){
 const [task,setTask]=useState<TaskContext|null>(null),[original,setOriginal]=useState<LocalCommand|null>(null),[problem,setProblem]=useState(''),[busy,setBusy]=useState(false);
 const disposed=useRef(false),working=useRef(false),generation=useRef(0);
 async function pending(){const store=await openWorkbenchLocal(principalId);try{return await store.getPending({principalId,projectId:workspace.project.projectId,runId:null,form:'task'});}finally{store.close();}}
 useEffect(()=>{disposed.current=false;const token=++generation.current;void pending().then(value=>{if(!disposed.current&&token===generation.current){setOriginal(value);setProblem('');}}).catch(()=>{if(!disposed.current&&token===generation.current)setProblem('暂时无法读取本机任务原记录，请重试打开；旧草稿和原请求仍保留。');});return()=>{disposed.current=true;generation.current++;};},[principalId,workspace.project.projectId,workspace.project.revision]);
 const current=():TaskContext=>({principalId,form:'task',projectId:workspace.project.projectId,runId:null,basisRevision:workspace.project.revision,basis:{baseAcceptedReleaseId:workspace.project.acceptedReleaseId}});
 async function change(work:()=>Promise<void>){if(working.current)return;working.current=true;setBusy(true);try{if(!await before()){setProblem('上次切换未完成。请先在当前表单核对保存状态，再重试切换目标。');return;}await work();}catch{if(!disposed.current)setProblem('暂时无法读取本机任务原记录，请重试打开；旧草稿和原请求仍保留。');}finally{working.current=false;if(!disposed.current)setBusy(false);}}
 function open(){void change(async()=>{const p=await pending();if(disposed.current)return;const next=p?p.envelope.context:current();if(next.form!=='task')throw Error('Wrong project original');setOriginal(p);setTask(next);setProblem('');});}
 const changed=task!==null&&(task.basisRevision!==workspace.project.revision||task.basis.baseAcceptedReleaseId!==workspace.project.acceptedReleaseId),canSubmit=task!==null&&workspace.allowedActions.includes('createTask')&&!changed&&task.basis.baseAcceptedReleaseId!==null;
 return <><section className={'card next-target'+(task?' expanded':'')} aria-label="下一目标入口"><h2>项目下一目标</h2>{problem&&<p role="alert">{problem}</p>}{!task?<><p>新目标会单独保存，不会改写当前执行。</p>{original&&<p className="notice">有一份新任务原提交结果待核实；重新进入不会自动发送。</p>}<button disabled={busy} onClick={open}>{original?'打开新任务原提交核实':workspace.allowedActions.includes('createTask')?'继续迭代或修复':'另存下一目标草稿'}</button></>:<><p>本页目标与当前执行分开保存。</p><p className="muted">起点：{task.basis.baseAcceptedReleaseId??'尚无已接受版本，仅可保存草稿'}</p>{!workspace.allowedActions.includes('createTask')&&<p className="notice">{workspace.run.terminalOutcome===null?'当前仍有活动执行，新目标仅保存为草稿。':'当前没有可用的任务提交条件，草稿继续保留。'}</p>}{changed&&<p className="notice">项目起点已变化，旧目标和原提交条件仍保留。当前已接受版本：{workspace.project.acceptedReleaseId??'尚无'}。<button disabled={busy} onClick={()=>void change(async()=>{const p=await pending();if(disposed.current)return;setOriginal(p);if(p){setProblem('请先核实原任务提交；不能更换其项目依据。');return;}setTask(current());setProblem('');})}>核对并使用当前项目起点，保留旧稿</button></p>}<button disabled={busy} onClick={()=>void change(async()=>{if(!disposed.current){setTask(null);setProblem('');setOriginal(await pending());}})}>返回当前执行输入，保留目标草稿</button></>}</section>{task?children(task,canSubmit):normal}</>;
}
