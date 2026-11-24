import {useId,useRef,useState} from 'react';
import type {AssistantExecutionDetails,AssistantTaskView,ConversationSummary} from '@devmesh/contracts';
import type {ConversationDetailTab} from './conversation-detail-reading.js';
import {ConversationText} from './conversation-text.js';
import {AssistantDownload} from './assistant-download.js';
import {AssistantPreview} from './assistant-preview.js';

const states:Record<string,string>={RUNNING:'正在执行',READY:'本轮已完成',BLOCKED:'需要处理',UNKNOWN:'结果待核实',SUPERSEDED:'先前轮次',SENT:'正在等待模型',RESPONDED:'模型已返回',DONE:'已完成',PREPARED:'已准备',SUCCEEDED:'成功',FAILED:'失败',ACCEPTED:'已接收'};
const tools:Record<string,string>={project_list:'查找文件',project_read:'读取文件',project_search:'搜索代码',project_write:'保存文件',project_patch:'局部修改文件',project_diff:'核对文件差异',project_check:'运行检查'};
const clock=(time:string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'short',timeStyle:'short'}).format(new Date(time));
const pendingStates:Partial<Record<ConversationSummary['state'],string>>={
 QUEUED:'等待执行',THINKING:'正在处理新要求',WORKING:'正在执行',WAITING_USER:'等待补充说明',
 WAITING_CONFIRMATION:'等待确认',PAUSING:'正在暂停',PAUSED:'已暂停',CANCELLING:'正在取消',
 CANCELLED:'已取消',BLOCKED:'需要处理',UNKNOWN:'结果待核实',
};

export function AssistantResultHistory({data,selectedId,onSelect}:{
 data:AssistantExecutionDetails|null;
 selectedId:string|null;
 onSelect:(id:string|null)=>void;
}){
 const [expanded,setExpanded]=useState(false),listId=useId(),trigger=useRef<HTMLButtonElement>(null);
 const current=data?.sessions.find(session=>session.inputRevision===data.currentInputRevision);
 const history=data?.sessions.filter(session=>session.sessionId!==current?.sessionId)??[];
 const selected=selectedId&&data?.selected?.task.sessionId===selectedId?data.selected:null;
 const hasHistory=(data?.sessionCount??0)>1&&history.length>0;
 if(!hasHistory&&!selectedId)return null;
 return <section className="assistant-result-history" aria-label="结果范围" onKeyDown={event=>{
  if(event.key==='Escape'&&expanded){
   event.stopPropagation();
   setExpanded(false);
   trigger.current?.focus();
  }
 }}>
  <div className="assistant-history-bar">
   {selectedId&&<span role="status">{selected?`正在查看历史结果 · ${clock(selected.createdAt)}`:'历史结果'}</span>}
   {selectedId&&<button type="button" onClick={()=>{setExpanded(false);onSelect(null);}}>返回最新</button>}
   {hasHistory&&<button type="button" ref={trigger} aria-expanded={expanded} aria-controls={listId} onClick={()=>setExpanded(!expanded)}>历史结果</button>}
  </div>
  {hasHistory&&<div id={listId} hidden={!expanded}>
   <ul className="assistant-history-list" aria-label="历史结果列表">
    {history.map(session=><li key={session.sessionId}>
     <button type="button" aria-current={session.sessionId===selectedId?'true':undefined} onClick={()=>{
      setExpanded(false);
      onSelect(session.sessionId);
     }}>
      <span className="assistant-history-goal">{session.goal||(session.mode==='READ'?'分析与计划':'任务执行')}</span>
      <span className="assistant-history-meta">{clock(session.startedAt??session.updatedAt)} · {session.mode==='READ'?'计划':'执行'} · {states[session.state]??session.state}</span>
     </button>
    </li>)}
   </ul>
   {data&&data.sessionCount>data.sessions.length&&<p className="muted">显示最近的 {data.sessions.length} 次执行范围。</p>}
  </div>}
 </section>;
}

function Checks({task}:{task:AssistantTaskView}){
 return <section className="detail-section" aria-label="执行检查"><h3>检查结果</h3>{task.checks.length?task.checks.map(c=><details className="assistant-detail-check" key={c.operationId}><summary>{c.check==='html'?'HTML 基础检查':c.check} · {states[c.state]??c.state}</summary><p className="muted">{c.backend==='STATIC_HTML'?'结构与内联脚本语法':'Docker 开发容器'} · 退出码 {c.exitCode??'待核实'} · {Math.round(c.durationMs/1000)} 秒</p><pre>{c.output||'无输出'}</pre></details>):<p className="muted">尚无已保存的检查结果。</p>}</section>;
}
export function AssistantExecutionPanel({principalId,current,tab,data,problem,selectedId,onRetry,onSelect,onTab,onConversation}:{principalId:string;current:ConversationSummary;tab:ConversationDetailTab;data:AssistantExecutionDetails|null;problem:boolean;selectedId:string|null;onRetry:()=>void;onSelect:(id:string)=>void;onTab:(tab:ConversationDetailTab)=>void;onConversation:()=>void}){
 const [preview,setPreview]=useState<{sessionId:string;url:string}|null>(null);
 const selected=data?.selected&&(selectedId||data.selected.task.inputRevision===current.inputRevision)?data.selected:null;
 const task=selected?.task;
 if(problem)return <div className="notice"><p role="alert">暂时无法读取助手执行详情，已保存成果仍可在对话中查看。</p><button onClick={onRetry}>重新读取执行详情</button></div>;
 if(!data)return <p role="status">正在读取助手执行详情…</p>;
 const previousId=selectedId?null:tab==='成果'?data.previousResult:tab==='预览'?data.previousPreview:null;
 const previous=previousId&&<button type="button" onClick={()=>onSelect(previousId)}>{previousId===data.previousPreview?'查看上次生成的网站':'查看上次成果'}</button>;
 const pending=pendingStates[current.state];
 if(!selected&&!selectedId&&(data.sessionCount>0||pending&&tab==='任务'))return <>
  {tab==='任务'&&data.currentGoal&&<section className="detail-section"><h3>本轮目标</h3><ConversationText text={data.currentGoal}/></section>}
  <p role="status">{pending??'本轮没有新的助手执行结果。'}</p>
  {previous}
 </>;
 if(!selected||!task)return <><h3>{tab==='协作'?'Agent 协作':tab==='成果'?'生成成果':tab==='预览'?'页面预览':tab==='记录'?'执行记录':'本轮目标'}</h3><p className="detail-empty">{tab==='记录'?'当前对话尚未关联执行。已保存的消息可在主对话中查看。':tab==='协作'?'本轮尚无助手执行记录。任务关联项目后，可查看对应的协作分工。':'本轮尚无助手执行记录。发起任务后，这里会显示实际执行与保存结果。'}</p><button onClick={onConversation}>回到已保存的对话</button></>;
 const base='/api/v1/conversations/'+encodeURIComponent(current.conversationId)+'/project-tasks/'+encodeURIComponent(task.sessionId);
 const published=['READY','BLOCKED','SUPERSEDED'].includes(task.state);
 const html=task.files.filter(f=>/\.html?$/i.test(f.path));
 const hasPreview=task.workspaceKind==='GENERATED'&&published&&html.length>0;
 const hasResult=published&&(task.files.length>0||task.changes.length>0);
 const url=(kind:'file'|'preview',f:AssistantTaskView['files'][number])=>base+'/'+kind+'?path='+encodeURIComponent(f.path)+'&sha256='+f.sha256;
 return <div className="assistant-execution-details">
 {tab==='任务'&&<><section className="detail-section"><h3>本轮目标</h3><ConversationText text={selected.goal||'请在对话中查看本轮需求。'}/><dl className="detail-facts"><dt>执行状态</dt><dd>{states[task.state]??task.state}</dd><dt>工作目录</dt><dd>{task.workspaceKind==='GENERATED'?'独立任务目录':'项目任务副本'}</dd><dt>文件变更</dt><dd>{task.changes.length} 个</dd><dt>检查结果</dt><dd>{task.verified?'已通过':task.checks.length?'尚未通过':'尚未检查'}</dd><dt>最近更新</dt><dd>{clock(task.updatedAt)}</dd></dl>{task.error&&<p role="status">{task.error==='ASSISTANT_CHECK_REQUIRED'?'检查尚未通过，可回到对话让助手继续修复。':'执行需要处理：'+task.error}</p>}</section>{selected.reply&&<section className="detail-section"><h3>处理结果</h3><ConversationText text={selected.reply}/></section>}<div className="actions"><button onClick={()=>onTab('成果')}>查看成果</button>{html.length>0&&published&&<button onClick={()=>onTab('预览')}>查看效果</button>}<button onClick={onConversation}>回到对话</button></div></>}
 {tab==='协作'&&<><section className="detail-section"><h3>主助手</h3><p>本轮由主助手独立执行，未派发多 Agent 协作。</p><dl className="detail-facts"><dt>执行状态</dt><dd>{states[task.state]??task.state}</dd><dt>模型处理</dt><dd>{selected.modelSteps} 步</dd><dt>工具操作</dt><dd>{selected.toolCalls} 次</dd></dl></section><section className="detail-section"><h3>实际使用的工具</h3>{selected.activities.some(a=>a.tool)?<ul>{[...new Set(selected.activities.flatMap(a=>a.tool?[a.tool]:[]))].map(name=><li key={name}>{tools[name]??name}</li>)}</ul>:<p className="muted">本轮没有已保存的工具操作。</p>}<button onClick={()=>onTab('记录')}>查看操作记录</button></section></>}
 {tab==='成果'&&<><section className="detail-section" aria-label="助手生成成果"><h3>{task.workspaceKind==='GENERATED'?'生成文件':'文件变更'}</h3>{task.workspaceKind==='GENERATED'&&task.files.length>0?task.files.map(f=><article className="assistant-detail-file" key={f.path}><strong>{f.path}</strong><p className="muted">{(f.size/1024).toFixed(1)} KB</p>{published&&<AssistantDownload principalId={principalId} url={url('file',f)} path={f.path} sha256={f.sha256}/>}</article>):<p className="muted">{task.changes.length?'变更已保存在项目任务副本，可在对话中审阅并应用。':'本轮没有生成或修改文件。'}</p>}{task.changes.map(c=><details className="assistant-detail-check" key={c.path}><summary>{c.path} · +{c.added} −{c.removed}</summary><pre aria-label={c.path+' 差异'}>{c.diff}</pre></details>)}</section><Checks task={task}/>{task.workspaceKind==='BOUND'&&task.changes.length>0&&<button onClick={onConversation}>{task.applied?'回到对话查看应用结果':'回到对话审阅并应用'}</button>}</>}
 {tab==='成果'&&!hasResult&&previous}
 {tab==='预览'&&<section className="detail-section" aria-label="助手页面预览">
  <h3>页面预览</h3>
  {hasPreview?html.map(file=><article className="assistant-detail-file" key={file.path}>
   <strong>{file.path}</strong>
   <button type="button" onClick={()=>setPreview({sessionId:task.sessionId,url:url('preview',file)})}>预览页面</button>
  </article>):<>
   <p className="muted">{task.state==='RUNNING'?'文件生成与检查仍在进行，保存完成后可预览。':task.workspaceKind==='BOUND'&&task.changes.length?'本轮变更已保存在项目任务副本。':'本轮没有可预览的 HTML 文件。'}</p>
   {previous}
  </>}
 </section>}
 {tab==='记录'&&<><h3>执行记录</h3><p className="muted">共 {selected.totalActivities} 项实际执行记录{selected.totalActivities>selected.activities.length?'，显示最近 '+selected.activities.length+' 项':''}。</p><ol className="conversation-detail-records">{selected.activities.toReversed().map(a=><li key={a.id}><span className="muted">{clock(a.startedAt)}</span><p>{a.kind==='MODEL'?'模型处理 · 第 '+a.stepNo+' 步':a.kind==='SESSION'?'助手执行':a.kind==='APPLICATION'?'应用变更到项目':tools[a.tool??'']??'工具操作'} · {states[a.state]??a.state}</p>{a.path&&<p className="hash">{a.path}</p>}{a.check&&<p>{a.check==='html'?'HTML 基础检查':a.check} · 退出码 {a.exitCode??'待核实'}</p>}</li>)}</ol><button onClick={onConversation}>回到已保存的对话</button></>}
 {preview?.sessionId===task.sessionId&&<AssistantPreview url={preview.url} onClose={()=>setPreview(null)}/>}
 </div>;
}
