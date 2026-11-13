import {useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {releaseExportEntryView,releaseExportListView,releaseExportView} from '@devmesh/contracts';

type Job=ReturnType<typeof releaseExportView.parse>;
type Entry=ReturnType<typeof releaseExportEntryView.parse>;
type Page=ReturnType<typeof releaseExportListView.parse>;
class ApiError extends Error {constructor(readonly status:number){super('Export request unavailable');}}
const labels:Record<Job['state'],string>={QUEUED:'已排队',PACKING:'正在打包',FAILED:'打包失败',READY:'可以下载'};
const time=(value:string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const active=(j:Job)=>j.state==='QUEUED'||j.state==='PACKING';
function size(n:number){return n<1024*1024?(n/1024).toFixed(1)+' KB':(n/1024/1024).toFixed(1)+' MB';}
function reason(job:Job){if(job.state==='QUEUED')return '等待打包服务处理。';if(job.state==='PACKING')return job.canRetry?'上次打包已中断，可以重试。':'正在准备此版本的交付文件。';const reasons:Record<string,string>={EXPORT_MATERIAL_MISSING:'缺少原始材料，请恢复材料后重试。',EXPORT_MATERIAL_CHANGED:'原始材料校验未通过，请核对后重试。',EXPORT_SOURCE_CHANGED:'原始源码校验未通过，请核对后重试。',EXPORT_INTERRUPTED:'上次打包被中断，可以重试。',EXPORT_LIMIT_EXCEEDED:'交付材料超过打包上限，请联系项目负责人。'};return job.state==='FAILED'?(Object.hasOwn(reasons,job.errorCode??'')?reasons[job.errorCode!]: '暂时无法完成打包，请稍后重试。'):'';}

function Exports({entry,initial}:{entry:Entry;initial:Page}){
  const base='/api/v1/releases/'+encodeURIComponent(entry.releaseId)+'/exports',key='devmesh.releaseExport.create:'+entry.releaseId;
  const [jobs,setJobs]=useState(initial.jobs),[next,setNext]=useState(initial.nextCursor),[cursors,setCursors]=useState<(string|null)[]>([null]);
  const [focused,setFocused]=useState<Job|null>(null),[busy,setBusy]=useState(false),[stale,setStale]=useState(false),[denied,setDenied]=useState(false),[message,setMessage]=useState('');
  const [pending,setPending]=useState<string|null>(()=>{try{const v=sessionStorage.getItem(key);return v&&/^[0-9a-f-]{36}$/i.test(v)?v:null;}catch{return null;}});
  const locked=useRef(false),disposed=useRef(false),controllers=useRef(new Set<AbortController>()),cursor=cursors.at(-1)??null;
  const request=useCallback(async(path:string,init:RequestInit={})=>{
    const controller=new AbortController();controllers.current.add(controller);
    try{
      const response=await fetch(path,{...init,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
      if(!response.ok)throw new ApiError(response.status);
      if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Invalid export response');
      return await response.json() as unknown;
    }finally{controllers.current.delete(controller);}
  },[]);
  const failure=useCallback((error:unknown)=>{
    if(disposed.current)return;
    setStale(true);
    if(error instanceof ApiError&&[401,403,404].includes(error.status)){setDenied(true);setJobs([]);setFocused(null);setMessage('访问权限已失效。请重新登录或联系项目负责人。');}
    else setMessage('暂时无法核实最新状态，请刷新后重试。');
  },[]);
  const run=useCallback(async(action:()=>Promise<void>)=>{
    if(locked.current||disposed.current)return;locked.current=true;setBusy(true);
    try{await action();}catch(error){failure(error);}finally{locked.current=false;if(!disposed.current)setBusy(false);}
  },[failure]);
  const load=useCallback(async(after:string|null)=>{
    const page=releaseExportListView.parse(await request(base+'?limit=20'+(after?'&afterExportId='+encodeURIComponent(after):'')));
    if(page.jobs.some(j=>j.releaseId!==entry.releaseId))throw Error('Wrong export release');
    let latest:Job|null=null;
    if(focused){latest=page.jobs.find(j=>j.exportId===focused.exportId)??releaseExportView.parse(await request('/api/v1/exports/'+encodeURIComponent(focused.exportId)));if(latest.releaseId!==entry.releaseId)throw Error('Wrong export release');}
    if(disposed.current)return;setJobs(page.jobs);setNext(page.nextCursor);if(latest)setFocused(latest);setStale(false);setMessage('');
  },[base,entry.releaseId,focused,request]);
  const refresh=useCallback(()=>run(()=>load(cursor)),[cursor,load,run]);
  const hasActive=jobs.some(active)||(focused!==null&&active(focused));
  useEffect(()=>{
    if(!hasActive||denied)return;
    let timer:ReturnType<typeof setTimeout>|undefined,cancelled=false;
    const schedule=()=>{if(timer)clearTimeout(timer);if(!cancelled&&!document.hidden)timer=setTimeout(async()=>{await refresh();schedule();},2000);};
    document.addEventListener('visibilitychange',schedule);schedule();
    return()=>{cancelled=true;if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',schedule);};
  },[hasActive,denied,refresh]);
  useEffect(()=>{
    const stop=()=>{disposed.current=true;for(const controller of controllers.current)controller.abort();};
    const restore=(event:PageTransitionEvent)=>{if(event.persisted)location.reload();};
    window.addEventListener('pagehide',stop);window.addEventListener('pageshow',restore);return()=>{stop();window.removeEventListener('pagehide',stop);window.removeEventListener('pageshow',restore);};
  },[]);
  const create=()=>run(async()=>{
    let original=pending;
    try{original??=crypto.randomUUID();sessionStorage.setItem(key,original);setPending(original);}catch{setMessage('浏览器无法保存创建请求。请允许此站点使用会话存储后重试。');return;}
    try{
      const job=releaseExportView.parse(await request(base,{method:'POST',headers:{'content-type':'application/json','idempotency-key':original},body:JSON.stringify({format:'zip'})}));
      if(job.releaseId!==entry.releaseId)throw Error('Wrong export release');if(disposed.current)return;
      setFocused(job);setStale(false);setMessage('已找到此创建请求的交付包。');
      try{sessionStorage.removeItem(key);setPending(null);}catch{/* Retain the same key until this tab can clear its known original. */}
    }catch(error){failure(error);if(!(error instanceof ApiError&&[401,403,404].includes(error.status)))setMessage('创建结果尚未核实。刷新状态后，点击“核实创建请求”继续找回原任务。');}
  });
  const retry=(job:Job)=>run(async()=>{
    try{
      const updated=releaseExportView.parse(await request('/api/v1/exports/'+encodeURIComponent(job.exportId)+'/retry',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedGeneration:job.generation})}));
      if(updated.exportId!==job.exportId||updated.releaseId!==entry.releaseId)throw Error('Wrong export job');
      setJobs(current=>current.map(j=>j.exportId===updated.exportId?updated:j));setFocused(current=>current?.exportId===updated.exportId?updated:current);setStale(false);setMessage('已核实原任务，等待打包。');
    }catch(error){failure(error);}
  });
  const move=(history:(string|null)[])=>run(async()=>{await load(history.at(-1)??null);if(!disposed.current)setCursors(history);});
  const card=(job:Job)=><article className="job" key={job.exportId} data-export-id={job.exportId}>
    <div className="job-head"><h3>创建于 {time(job.createdAt)}</h3><span className={'badge '+job.state}>{labels[job.state]}</span></div>
    {reason(job)&&<p className="muted">{reason(job)}</p>}
    <dl className="job-details"><div><dt>源码版本</dt><dd className="commit">{job.codeCommit}</dd></div><div><dt>交付文件</dt><dd>{job.state==='READY'&&job.archiveSize!==null?'ZIP · '+size(job.archiveSize):'完成打包后可下载'}</dd></div></dl>
    <div className="actions">{job.state==='READY'&&!stale&&!denied&&<a className="download" href={'/api/v1/exports/'+encodeURIComponent(job.exportId)+'/download'} download>下载交付包</a>}{job.canRetry&&<button disabled={busy||stale||denied} onClick={()=>void retry(job)}>重试打包</button>}</div>
    <details><summary>版本与校验信息</summary><p className="commit">任务：{job.exportId}<br/>记录截止：{job.cutoffSeq}<br/>快照 SHA-256：{job.snapshotHash}{job.archiveHash&&<><br/>文件 SHA-256：{job.archiveHash}</>}</p></details>
  </article>;
  return <main>
    <nav className="topline"><span className="brand">DevMesh</span><a href={'/api/v1/runs/'+encodeURIComponent(entry.runId)+'/releases/'+encodeURIComponent(entry.releaseId)+'/view'}>返回已接受版本</a></nav>
    <header><div className="eyebrow">版本交付</div><h1>把成果，完整带走。</h1><p className="muted">下载此版本的源码、运行说明、配置与协作记录。交付包不包含业务数据。</p></header>
    <section className="version" aria-label="已接受版本"><div className="version-head"><strong>{entry.isCurrentAccepted?'当前已接受版本':'历史已接受版本'}</strong><span className="muted">接受于 {time(entry.acceptedAt)}</span></div><p className="commit">{entry.codeCommit}</p></section>
    <div className="toolbar"><h2>交付记录</h2><div className="actions"><button disabled={busy||denied} onClick={()=>void refresh()}>刷新状态</button><button className="primary" disabled={busy||stale||denied} onClick={()=>void create()}>{busy?'正在处理…':pending?'核实创建请求':'创建交付包'}</button></div></div>
    {pending&&!message&&<p className="notice" role="status">上次创建请求尚未核实，点击“核实创建请求”找回原任务。</p>}
    {message&&<p className={'notice'+(stale?' error':'')} role="status">{message}</p>}
    {focused&&!denied&&<><p className="section-label">本次创建的交付包</p>{card(focused)}</>}
    {!denied&&<><div className="jobs" aria-label="交付包列表">{jobs.filter(j=>j.exportId!==focused?.exportId).map(card)}{!jobs.length&&!focused&&<div className="empty"><strong>此版本还没有交付包</strong><p className="muted">点击“创建交付包”，准备可以带走的项目成果。</p></div>}</div><div className="pager"><button disabled={busy||cursors.length===1} onClick={()=>void move(cursors.slice(0,-1))}>上一页</button><span className="muted">第 {cursors.length} 页</span><button disabled={busy||next===null} onClick={()=>void move([...cursors,next])}>下一页</button></div></>}
    <p className="footer">交付文件始终对应这里显示的已接受版本。</p>
  </main>;
}
const root=document.getElementById('root')!,data=document.getElementById('export-data')!;
try{const initial=JSON.parse(data.textContent??'') as {entry:unknown;list:unknown};createRoot(root).render(<Exports entry={releaseExportEntryView.parse(initial.entry)} initial={releaseExportListView.parse(initial.list)}/>);}
catch{root.textContent='交付记录无法加载，请刷新页面重试。';}
