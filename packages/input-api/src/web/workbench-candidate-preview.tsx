import {useEffect,useRef,useState} from 'react';
import {candidatePreviewWorkspace,previewEntryView} from '@devmesh/contracts';
import type {z} from 'zod';
import type {WorkbenchRead} from './workbench-api.js';

type PreviewWorkspace=z.output<typeof candidatePreviewWorkspace>;
type Entry=z.output<typeof previewEntryView>;
const states:Record<string,string>={STARTING:'启动中',READY:'最近观察就绪',STOPPING:'停止待核实',STOPPED:'已停止',EXPIRED:'已过期',UNKNOWN:'结果待核实'};
const accessNames:Record<string,string>={AVAILABLE:'访问可用',NOT_CONFIGURED:'预览访问未配置',RECOVERING:'访问恢复中',STARTING:'启动中',STOPPING:'停止待核实',STOPPED:'已停止',EXPIRED:'已过期',UNKNOWN:'结果待核实'};
const time=(value:string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));

export function WorkbenchCandidatePreview({projectId,runId,candidateId,read,onOpen}:{projectId:string;runId:string;candidateId:string;read:WorkbenchRead;onOpen:(path:string)=>Promise<void>}){
 const [value,setValue]=useState<PreviewWorkspace|null>(null),[entries,setEntries]=useState<Record<string,Entry>>({}),[problem,setProblem]=useState(false),[loading,setLoading]=useState(true),[revision,reload]=useState(0),reader=useRef(read);reader.current=read;
 const base='/api/v1/runs/'+encodeURIComponent(runId)+'/candidates/'+encodeURIComponent(candidateId)+'/preview-management';
 useEffect(()=>{
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;setValue(null);setEntries({});setLoading(true);setProblem(false);
  const load=async()=>{try{
   const next=candidatePreviewWorkspace.parse(await reader.current(base+'?limit=20'));
   if(next.projectId!==projectId||next.runId!==runId||next.candidateId!==candidateId||next.previews.some(item=>item.preview.runId!==runId||item.preview.candidateId!==candidateId))throw Error('Wrong preview context');
   const observations=await Promise.allSettled(next.previews.map(async item=>{
    const entry=previewEntryView.parse(await reader.current('/api/v1/runs/'+encodeURIComponent(runId)+'/previews/'+encodeURIComponent(item.preview.previewId)));
    if(entry.preview.runId!==runId||entry.preview.candidateId!==candidateId||entry.preview.previewId!==item.preview.previewId)throw Error('Wrong preview entry');return entry;
   }));
   if(!stopped){setValue(next);setEntries(Object.fromEntries(observations.flatMap(item=>item.status==='fulfilled'?[[item.value.preview.previewId,item.value]]:[])));setProblem(false);}
  }catch{if(!stopped){setValue(null);setEntries({});setProblem(true);}}finally{if(!stopped){setLoading(false);timer=setTimeout(()=>void load(),5000);}}};void load();return()=>{stopped=true;if(timer)clearTimeout(timer);};
 },[base,projectId,runId,candidateId,revision]);
 return <section className="detail-section" aria-label="应用预览状态"><h3>应用预览</h3>
  {loading&&<p role="status">正在核实此版本的预览…</p>}
  {problem&&<div className="notice"><p role="alert">暂时无法读取此版本的预览状态。</p><button onClick={()=>reload(value=>value+1)}>重试读取预览</button></div>}
  {value&&<>
   {!value.configured&&<p className="notice">新预览创建尚未启用；已有预览按实际访问状态查看。</p>}
   <p className="muted">{value.dataPlan.strategy==='INITIAL'?'使用独立的初始预览数据。':'使用来源版本的隔离预览数据。'}预览体验与接受交付分别操作。</p>
   {!value.previews.length&&<p>{value.configured?'此版本尚未启动预览，可进入管理页准备数据并启动。':'此版本尚无预览实例。'}</p>}
   {value.previews.toReversed().map(item=>{const preview=entries[item.preview.previewId]?.preview??item.preview,entry=entries[preview.previewId];return <article className="detail-work" key={preview.previewId}>
    <h4>{states[preview.state]??preview.state}</h4><p>{entry?accessNames[entry.access.state]:'访问状态暂不可读'}</p>
    <dl className="detail-facts"><dt>有效期至</dt><dd>{time(preview.expiresAt)}</dd><dt>健康观察</dt><dd>{preview.healthCheckedAt?time(preview.healthCheckedAt):'尚无核实记录'}</dd></dl>
    {entry?.access.state==='AVAILABLE'&&<button className="primary" onClick={()=>void onOpen('/api/v1/runs/'+encodeURIComponent(runId)+'/previews/'+encodeURIComponent(preview.previewId)+'/view')}>打开应用</button>}
   </article>;})}
   {value.nextPreviewSequence!==null&&<p className="muted">这里只显示前 20 条预览记录，更多实例请进入管理页查看。</p>}
   <div className="actions"><button onClick={()=>void onOpen(base+'/view')}>{value.previews.length?'管理此候选预览与数据':value.configured?'管理并启动预览':'查看预览条件与数据'}</button><button onClick={()=>reload(value=>value+1)}>刷新预览状态</button></div>
  </>}
 </section>;
}
