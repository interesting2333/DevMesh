import {useEffect,useRef,useState} from 'react';
import type {z} from 'zod';
import {workbenchDeliveryView} from '@devmesh/contracts';
import type {workspaceView} from '@devmesh/contracts';
import type {WorkbenchRead} from './workbench-api.js';

type Workspace=z.output<typeof workspaceView>;
type Delivery=z.output<typeof workbenchDeliveryView>;
export type DeliveryReading={candidateId:string|null;candidateAfterRevision:number};
const time=(value:string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export function WorkbenchDelivery({workspace,read,reading,onReading,before,onOpen,focus}:{workspace:Workspace;read:WorkbenchRead;reading:DeliveryReading;onReading:(value:DeliveryReading)=>void;before:()=>Promise<boolean>;onOpen:(path:string,targetRunId:string)=>Promise<boolean>;focus:'成果'|'预览'}){
 const [value,setValue]=useState<Delivery|null>(null),[problem,setProblem]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const generation=useRef(0),disposed=useRef(false),working=useRef(false);
 const {projectId}=workspace.project,{runId}=workspace.run;
 useEffect(()=>{
  disposed.current=false;const token=++generation.current;setValue(null);setLoading(true);setProblem('');
  const query=new URLSearchParams({afterRevision:String(reading.candidateAfterRevision),limit:'20'});if(reading.candidateId)query.set('selectedCandidateId',reading.candidateId);
  void read('/api/v1/projects/'+encodeURIComponent(projectId)+'/runs/'+encodeURIComponent(runId)+'/delivery?'+query).then(raw=>{
   const next=workbenchDeliveryView.parse(raw);
   if(next.projectId!==projectId||next.runId!==runId||next.mode!==workspace.mode||next.membership!==workspace.membership||next.resourceRevision!==workspace.run.resourceRevision||next.projectRevision!==workspace.project.revision||next.eventCursor!==workspace.eventCursor||next.acceptedRelease?.releaseId!==workspace.project.acceptedReleaseId&&!(next.acceptedRelease===null&&workspace.project.acceptedReleaseId===null)||next.selectedCandidate?.candidateId!==(reading.candidateId??undefined)||next.candidates.some(item=>item.revision<=reading.candidateAfterRevision))throw Error('Delivery basis changed');
   if(!disposed.current&&token===generation.current)setValue(next);
  }).catch(()=>{if(!disposed.current&&token===generation.current)setProblem('当前交付状态暂不可读，或依据已经变化。请刷新当前执行后重试；当前草稿仍保留。');}).finally(()=>{if(!disposed.current&&token===generation.current)setLoading(false);});
  return()=>{disposed.current=true;generation.current++;};
 },[projectId,runId,workspace.project.revision,workspace.project.acceptedReleaseId,workspace.run.resourceRevision,workspace.eventCursor,workspace.mode,workspace.membership,reading.candidateId,reading.candidateAfterRevision,reload]);
 async function change(next:DeliveryReading){
  if(working.current)return;working.current=true;setBusy(true);
  try{if(!await before()){setProblem('上次切换未完成，请先在当前表单核对保存状态，再重试。');return;}if(!disposed.current){onReading(next);setProblem('');}}
  finally{working.current=false;if(!disposed.current)setBusy(false);}
 }
 async function open(path:string,targetRunId=runId){
  if(working.current)return;working.current=true;setBusy(true);
  try{if(!await onOpen(path,targetRunId)&&!disposed.current)setProblem('尚未离开工作台。请核对当前表单及阅读位置保存状态，再重试。');}
  catch{if(!disposed.current)setProblem('暂时无法保存返回位置。页面与草稿仍保留，请重试。');}
  finally{working.current=false;if(!disposed.current)setBusy(false);}
 }
 const selected=value?.selectedCandidate,base=selected?'/api/v1/runs/'+encodeURIComponent(runId)+'/candidates/'+encodeURIComponent(selected.candidateId):null,disabled=busy||loading;
 return <section aria-label={focus==='成果'?'候选与已接受成果':'候选预览入口'}>
  <h2>{focus==='成果'?'候选与交付成果':'查看候选预览'}</h2>
  <p className="muted">候选属于当前查看的执行。打开审查或管理页面后，可返回继续查看。</p>
  {problem&&<div className="notice"><p role="alert">{problem}</p><button disabled={disabled} onClick={()=>void change({candidateId:null,candidateAfterRevision:0})}>重新选择当前执行候选</button></div>}
  <button disabled={disabled} onClick={()=>setReload(value=>value+1)}>重新读取交付状态</button>
  {loading&&<p role="status">正在读取已保存候选…</p>}
  {value&&<>
   <section aria-label="已冻结候选"><h3>已冻结候选</h3>
    {!value.candidates.length&&<p>此执行尚无已冻结候选。</p>}
    {value.candidates.map(candidate=><article className="card" key={candidate.candidateId}>
     <h4>候选 {candidate.revision} · {candidate.qualification==='CURRENT'?'当前依据':'旧依据，只读核对'}</h4>
     <p className="hash">{candidate.codeCommit}</p><p className="muted">冻结于 {time(candidate.createdAt)}</p>
     <button disabled={disabled} aria-pressed={reading.candidateId===candidate.candidateId} onClick={()=>void change({...reading,candidateId:candidate.candidateId})}>选择候选 {candidate.revision}</button>
    </article>)}
    <div className="actions"><button disabled={disabled||reading.candidateAfterRevision===0} onClick={()=>void change({...reading,candidateAfterRevision:0})}>查看最初候选</button><button disabled={disabled||value.nextRevision===null} onClick={()=>void change({...reading,candidateAfterRevision:value.nextRevision!})}>查看后续候选</button></div>
   </section>
   {!selected?<p>请先选择一份已冻结候选。</p>:<section className="notice" aria-label="已选候选"><h3>已选候选 {selected.revision}</h3><p>{selected.qualification==='CURRENT'?'候选仍对应当前依据。':'此候选依据已变化，只供核对；可用操作由目标页面重新核实。'}</p><p className="hash">{selected.codeCommit}</p><p>自动检查已通过，逐项审查结论请进入审查页核对。</p><div className="actions"><button disabled={disabled} onClick={()=>void open(base+'/review/view')}>逐项审查此候选</button><button disabled={disabled} onClick={()=>void open(base+'/preview-management/view')}>查看此候选预览与数据</button><button disabled={disabled} onClick={()=>void open(base+'/acceptance/view')}>核对此候选接受依据</button></div></section>}
   <section aria-label="项目已接受版本"><h3>项目当前已接受版本</h3>{!value.acceptedRelease?<p>项目尚无已接受版本。</p>:<><p className="hash">{value.acceptedRelease.codeCommit}</p><p className="muted">接受于 {time(value.acceptedRelease.acceptedAt)}{value.acceptedRelease.runId!==runId?' · 来自另一执行':''}</p><p>打开版本页可核对当前发布状态。</p><div className="actions"><button disabled={disabled} onClick={()=>void open('/api/v1/runs/'+encodeURIComponent(value.acceptedRelease!.runId)+'/releases/'+encodeURIComponent(value.acceptedRelease!.releaseId)+'/view',value.acceptedRelease!.runId)}>查看已接受版本</button><button disabled={disabled} onClick={()=>void open('/api/v1/releases/'+encodeURIComponent(value.acceptedRelease!.releaseId)+'/exports/view',value.acceptedRelease!.runId)}>查看此版本交付包</button></div></>}</section>
  </>}
 </section>;
}
