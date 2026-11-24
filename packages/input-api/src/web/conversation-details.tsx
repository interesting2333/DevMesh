import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {workspaceView,ids,opaqueKey,epoch,timestamp,assistantExecutionDetails} from '@devmesh/contracts';
import {AssistantExecutionPanel,AssistantResultHistory} from './assistant-execution-details.js';
import type {ConversationSummary,ConversationMessage} from '@devmesh/contracts';
import {ConversationWorkDetails,workRoles,workStates} from './conversation-work-context.js';
import type {WorkContext} from './conversation-work-context.js';
import {WorkbenchDelivery} from './workbench-delivery.js';
import type {DeliveryReading} from './workbench-delivery.js';
import {WorkbenchIcon as Icon} from './workbench-icons.js';
import {ConversationText} from './conversation-text.js';
import {conversationDetailTabs,detailReadingKey,readDetailReading,saveDetailReading} from './conversation-detail-reading.js';
import type {ConversationDetailTab} from './conversation-detail-reading.js';
export {conversationDetailTabs};
export type {ConversationDetailTab};

type Read=(path:string)=>Promise<unknown>;
const changesView=z.looseObject({changes:z.array(z.looseObject({changeId:ids.change,runId:ids.run,state:opaqueKey,proposedText:z.string().max(20000)})).max(100)});
const configsView=z.looseObject({adjustments:z.array(z.looseObject({adjustmentId:opaqueKey,runId:ids.run,state:opaqueKey})).max(100)});
const generationView=z.looseObject({generation:epoch});
const eventsView=z.strictObject({events:z.array(z.looseObject({eventId:opaqueKey,projectId:ids.project,runId:ids.run,seq:epoch,type:opaqueKey,observedAt:timestamp,workId:ids.work.nullable().optional()})).max(200),nextCursor:epoch});
const names:Record<ConversationDetailTab,string>={'任务':'概览','协作':'协作','成果':'成果','预览':'预览','记录':'记录'};
const eventNames:Record<string,string>={InputSaved:'输入已保存',UnderstandingUpdated:'需求理解已更新',RequirementPublished:'需求已整理',RequirementsPublished:'需求已整理',QuestionAnswered:'澄清回答已保存',PlanPublished:'方案已保存',PlanConfirmed:'方案已确认',WorkAdmitted:'工作已进入执行',AttemptTransitioned:'工作状态已更新',AttemptStateChanged:'工作状态已更新',A2ATaskObserved:'协作任务状态已更新',ToolOperationUpdated:'工具操作已更新',ArtifactRegistered:'成果已登记',ChangeApplied:'变更已应用',DecisionSaved:'决定已保存',ConfigurationApplied:'配置已应用',CandidateUpdated:'候选版本已更新',ReleaseAccepted:'交付已接受',PreviewStateChanged:'预览状态已更新',ExportUpdated:'导出状态已更新',ControlProgress:'任务控制状态已更新'};
const decisions:Record<string,string>={PROPOSED:'待审阅',CONFIRMED:'已确认',APPLIED:'已应用',REJECTED:'已拒绝',SUPERSEDED:'已由新版本替代'};
const clock=(value:string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));

// Each section loads independently so a configuration failure cannot hide roles or a plan.
function useDetailResource<T>(key:string,enabled:boolean,read:Read,load:(reader:Read)=>Promise<T>){
 const [state,setState]=useState<{key:string;value:T|null;problem:boolean;at:string|null}>({key:'',value:null,problem:false,at:null}),[revision,reload]=useState(0),latest=useRef({read,load});latest.current={read,load};
 useEffect(()=>{if(!enabled)return;let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  const poll=async()=>{try{const value=await latest.current.load(latest.current.read);if(!stopped)setState({key,value,problem:false,at:new Date().toISOString()});}catch{if(!stopped)setState({key,value:null,problem:true,at:null});}if(!stopped)timer=setTimeout(()=>void poll(),3000);};void poll();return()=>{stopped=true;if(timer)clearTimeout(timer);};
 },[key,enabled,revision]);
 const current=enabled&&state.key===key?state:null;
 return {value:current?.value??null,problem:current?.problem??false,at:current?.at??null,retry:()=>reload(value=>value+1)};
}

export function ConversationDetails({principalId,current,context,contextError,messages,open,tab,onTab,read,beforeOpen,legacy,planRequest=0,candidateRequest,onConversation}:{principalId:string;current:ConversationSummary|undefined;context:WorkContext|null;contextError:boolean;messages:ConversationMessage[];open:boolean;tab:ConversationDetailTab;onTab:(tab:ConversationDetailTab)=>void;read:Read;beforeOpen:()=>Promise<boolean>;legacy:string;planRequest?:number;candidateRequest:{runId:string;candidateId:string;tab:'成果'|'预览'}|null;onConversation:()=>void}){
 const uid=useId(),buttons=useRef<(HTMLButtonElement|null)[]>([]),panel=useRef<HTMLElement|null>(null),content=useRef<HTMLDivElement|null>(null),restoringScroll=useRef(false),bound=!!current?.projectId&&!!current.runId;
 const preferenceKey=current?detailReadingKey(principalId,current.conversationId,current.runId):null;
 const [saved]=useState(()=>preferenceKey?readDetailReading(preferenceKey):null),[reading,setReading]=useState<DeliveryReading>({candidateId:saved?.candidateId??null,candidateAfterRevision:saved?.candidateAfterRevision??0}),[notice,setNotice]=useState('');
 const positions=useRef<Record<ConversationDetailTab,number>>(saved?.positions??{'任务':0,'协作':0,'成果':0,'预览':0,'记录':0}),restored=useRef(false),tabCallback=useRef(onTab);tabCallback.current=onTab;
 useEffect(()=>{if(saved)tabCallback.current(saved.tab);},[saved]);
 useEffect(()=>{if(candidateRequest&&candidateRequest.runId===current?.runId){setReading({candidateId:candidateRequest.candidateId,candidateAfterRevision:0});tabCallback.current(candidateRequest.tab);}},[candidateRequest,current?.runId]);
 function remember(nextTab=tab,nextReading=reading){if(!preferenceKey)return;try{saveDetailReading(preferenceKey,{tab:nextTab,...nextReading,positions:positions.current,updatedAt:Date.now()});setNotice('');}catch{setNotice('阅读位置暂时无法保存，当前草稿仍保留。');}}
 function switchTab(next:ConversationDetailTab){if(panel.current)positions.current[tab]=panel.current.scrollTop;remember(next);onTab(next);}
 function changeReading(next:DeliveryReading){setReading(next);remember(tab,next);}
 useLayoutEffect(()=>{if(!open||!panel.current||!content.current)return;const target=positions.current[tab];restoringScroll.current=true;const restore=()=>{if(!restoringScroll.current||!panel.current)return;if(panel.current.scrollHeight-panel.current.clientHeight>=target){panel.current.scrollTop=target;restoringScroll.current=false;}};const observer=new ResizeObserver(restore);observer.observe(content.current);restore();return()=>{observer.disconnect();restoringScroll.current=false;};},[open,tab]);
 useEffect(()=>{if(!restored.current){restored.current=true;return;}remember();},[reading,tab]);
 const projectId=current?.projectId,runId=current?.runId,scope=(projectId??'')+':'+(runId??'');
 const [selection,setSelection]=useState<{scope:string;id:string|null}>({scope:'',id:null});
 const assistantScope=principalId+':'+current?.conversationId;
 const selectedId=selection.scope===assistantScope?selection.id:null;
 const assistant=useDetailResource(assistantScope+':'+current?.inputRevision+':'+(selectedId??'current'),open&&!!current,read,async reader=>{
  const url='/api/v1/conversations/'+encodeURIComponent(current!.conversationId)+'/execution-details';
  const value=assistantExecutionDetails.parse(await reader(url+(selectedId?'?sessionId='+encodeURIComponent(selectedId):'')));
  if(value.conversationId!==current!.conversationId||value.currentInputRevision!==current!.inputRevision||selectedId&&value.selected?.task.sessionId!==selectedId)throw Error('Wrong assistant execution context');
  return value;
 });
 function selectAssistantResult(id:string|null){
  setSelection({scope:assistantScope,id});
  if(panel.current)panel.current.scrollTop=0;
  buttons.current[conversationDetailTabs.indexOf(tab)]?.focus();
 }
 const assistantMode=!bound||selectedId!==null||assistant.value?.selected?.task.inputRevision===current?.inputRevision;
 const workspace=useDetailResource(scope,open&&bound&&!assistantMode&&(tab==='成果'||tab==='预览'),read,async reader=>{const next=workspaceView.parse(await reader('/api/v1/projects/'+encodeURIComponent(projectId!)+'/workspace?runId='+encodeURIComponent(runId!)+'&limit=1'));if(next.project.projectId!==projectId||next.run.runId!==runId)throw Error('Wrong execution context');return next;});
 const changes=useDetailResource(scope,open&&bound&&!assistantMode&&tab==='任务',read,async reader=>{const next=changesView.parse(await reader('/api/v1/runs/'+encodeURIComponent(runId!)+'/changes?limit=50'));if(next.changes.some(item=>item.runId!==runId))throw Error('Wrong changes context');return next;});
 const config=useDetailResource(scope,open&&bound&&!assistantMode&&tab==='协作',read,async reader=>{const [adjustments,generation]=await Promise.all([reader('/api/v1/runs/'+encodeURIComponent(runId!)+'/config-adjustments?limit=50').then(value=>configsView.parse(value)),reader('/api/v1/config/generation?runId='+encodeURIComponent(runId!)).then(value=>generationView.parse(value))]);if(adjustments.adjustments.some(item=>item.runId!==runId))throw Error('Wrong configuration context');return {...adjustments,...generation};});
 const events=useDetailResource(scope,open&&bound&&!assistantMode&&tab==='记录',read,async reader=>{const w=workspaceView.parse(await reader('/api/v1/projects/'+encodeURIComponent(projectId!)+'/workspace?runId='+encodeURIComponent(runId!)+'&limit=1'));if(w.project.projectId!==projectId||w.run.runId!==runId)throw Error('Wrong event workspace');const result=eventsView.parse(await reader('/api/v1/projects/'+encodeURIComponent(projectId!)+'/runs/'+encodeURIComponent(runId!)+'/events?afterSeq='+Math.max(0,w.eventCursor-50)+'&limit=50'));if(result.events.some(item=>item.projectId!==projectId||item.runId!==runId))throw Error('Wrong event context');return result;});
 async function external(path:string){
  const target=window.open('about:blank','_blank');if(!target){setNotice('浏览器阻止了新窗口，请允许此站点打开专用页面后重试。');return false;}
  target.opener=null;
  try{if(!await beforeOpen()){target.close();return false;}remember();target.location.replace(path);return true;}catch{target.close();setNotice('暂时无法打开专用页面，当前页面和草稿仍保留。');return false;}
 }
 return <>
 {open&&assistantMode&&current&&<AssistantResultHistory key={assistantScope} data={assistant.value} selectedId={selectedId} onSelect={selectAssistantResult}/>}
 <div className="tabs conversation-detail-tabs" role="tablist" aria-label="执行信息">{conversationDetailTabs.map((name,index)=><button ref={element=>{buttons.current[index]=element;}} type="button" key={name} id={uid+'-tab-'+index} role="tab" aria-selected={name===tab} aria-controls={uid+'-panel'} tabIndex={name===tab?0:-1} onClick={()=>switchTab(name)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?conversationDetailTabs.length-1:(index+(e.key==='ArrowLeft'?-1:1)+conversationDetailTabs.length)%conversationDetailTabs.length;switchTab(conversationDetailTabs[next]!);buttons.current[next]?.focus();}}}><Icon name={(['task','team','artifact','preview','record'] as const)[index]!}/>{names[name]}</button>)}</div>
 <section ref={panel} className="conversation-detail-panel" id={uid+'-panel'} role="tabpanel" aria-labelledby={uid+'-tab-'+conversationDetailTabs.indexOf(tab)} onWheel={()=>{restoringScroll.current=false;}} onTouchStart={()=>{restoringScroll.current=false;}} onKeyDown={()=>{restoringScroll.current=false;}} onScroll={()=>{if(panel.current&&!restoringScroll.current){positions.current[tab]=panel.current.scrollTop;remember();}}}>
 <div ref={content} className="detail-scroll-content">{notice&&<p className="notice" role="status">{notice}</p>}
 {assistantMode&&current?<AssistantExecutionPanel key={assistantScope+':'+assistant.value?.selected?.task.sessionId} principalId={principalId} current={current} tab={tab} data={assistant.value} problem={assistant.problem} selectedId={selectedId} onRetry={assistant.retry} onSelect={selectAssistantResult} onTab={switchTab} onConversation={onConversation}/>:<>
 {tab==='任务'&&<>{context?<ConversationWorkDetails context={context} legacy={legacy} planRequest={planRequest} onConversation={onConversation}/>:<p className="detail-empty">{bound?(contextError?'暂时无法核实本轮任务，正在重试。':'正在读取本轮任务…'):'描述需求并发起研发任务后，可在这里查看目标、进度与待办。'}</p>}
 {bound&&<section className="detail-section" aria-label="需求变更"><h3>需求变更</h3>{changes.problem?<><p role="alert">需求变更暂不可读。</p><button onClick={changes.retry}>重试读取变更</button></>:changes.value?<>{changes.value.changes.length?changes.value.changes.map(item=><details key={item.changeId}><summary>{decisions[item.state]??item.state} · 需求变更</summary><ConversationText text={item.proposedText}/><a href={legacy} target="_blank" rel="noreferrer">查看变更依据与处理入口 ↗</a></details>):<p className="muted">本轮暂无需求变更提案。</p>}{changes.value.changes.length===50&&<p className="muted">这里只显示前 50 条提案，完整记录请进入技术视图。</p>}</>:<p role="status">正在读取需求变更…</p>}</section>}{changes.at&&<p className="detail-observed">最近核实 {clock(changes.at)}</p>}</>}
 {tab==='协作'&&<><h3>Agent 协作</h3><p className="muted">按实际工作查看角色分工，工作派发与 Agent 在线状态分别核实。</p>{!bound?<p className="detail-empty">任务关联项目后，将显示本轮角色、工作和配置。</p>:<>
 {context?<section className="detail-section"><h4>参与角色与工作</h4>{context.works.length?[...new Set(context.works.map(item=>item.role))].map(role=>{const label=workRoles[role]??role,works=context.works.filter(item=>item.role===role);return works.length?<article className="detail-work" key={role}><h4>{label}</h4>{works.map(work=><div key={work.workId}><p>{work.goal}</p><p className="muted">{work.state?workStates[work.state]??'状态待核实':'尚未派发'}</p></div>)}</article>:null;}):<p className="muted">本轮尚无已发布的工作分工。</p>}</section>:<p role="status">{contextError?'角色分工暂不可读，正在重试。':'正在核实角色分工…'}</p>}
 <section className="detail-section"><h4>交接与工具</h4><p className="muted">当前详情尚未接入 Agent 交接与工具调用记录。</p><a href={legacy} target="_blank" rel="noreferrer">查看工作依赖与技术记录 ↗</a></section>
 <details className="detail-section"><summary>本次配置记录</summary>{config.problem?<><p role="alert">本次配置记录暂不可读。</p><button onClick={config.retry}>重试读取配置</button></>:config.value?<><p>当前部署配置修订 {config.value.generation}</p><p className="muted">此编号对应当前部署，本轮配置调整单独列在下方。</p>{config.value.adjustments.length?config.value.adjustments.map(item=><p key={item.adjustmentId}>配置调整 · {decisions[item.state]??item.state}</p>):<p className="muted">本轮暂无配置调整。</p>}<a href={legacy} target="_blank" rel="noreferrer">查看脱敏配置依据 ↗</a></>:<p role="status">正在读取配置记录…</p>}</details></>}</>}
 {(tab==='成果'||tab==='预览')&&(open&&workspace.value?<><p className="detail-context">{workspace.value.mode==='history'?'历史执行':'当前执行'} · {({owner:'项目负责人',operator:'项目操作者',viewer:'只读成员'})[workspace.value.membership]}</p><WorkbenchDelivery key={workspace.value.run.runId+':'+tab} workspace={workspace.value} read={read} reading={reading} onReading={changeReading} before={beforeOpen} onOpen={external} focus={tab} onPreview={()=>switchTab('预览')}/></>:!bound?<><h3>{tab==='成果'?'成果与验收':'应用预览'}</h3><p className="detail-empty">{tab==='成果'?'尚未产生交付成果。任务执行并保存候选后，会在这里显示。':'尚无可预览的候选。准备好候选后，可在这里查看运行状态与效果。'}</p></>:workspace.problem?<div className="notice"><p role="alert">暂时无法读取本轮{names[tab]}信息。</p><button onClick={workspace.retry}>重新读取{names[tab]}</button></div>:<p role="status">正在读取{names[tab]}…</p>)}
 {tab==='记录'&&<><h3>执行记录</h3>{!bound?<p className="detail-empty">当前对话尚未关联执行。已保存的消息可在主对话中查看。</p>:events.problem?<><p role="alert">最近执行记录暂不可读。</p><button onClick={events.retry}>重试读取记录</button></>:events.value?<><p className="muted">最近 {events.value.events.length} 条执行事件（最多 50 条），按事件序号排列。</p>{events.value.events.length?<ol className="conversation-detail-records">{events.value.events.toReversed().map(event=><li key={event.eventId}><span className="muted">{clock(event.observedAt)} · #{event.seq}</span><p>{eventNames[event.type]??'未识别的事件类型：'+event.type}</p>{event.workId&&<p className="hash">工作 {event.workId}</p>}</li>)}</ol>:<p className="muted">本轮最近范围内暂无执行事件。</p>}</>:<p role="status">正在读取执行记录…</p>}
 {messages.length>0&&<button onClick={onConversation}>回到已保存的对话</button>}{bound&&<p><a href={legacy} target="_blank" rel="noreferrer">查看完整输入与技术记录 ↗</a></p>}</>}
 </>}
 </div></section></>;
}
