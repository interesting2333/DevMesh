import {useEffect,useId,useRef,useState} from 'react';
import {z} from 'zod';
import {workspaceView,ids,opaqueKey,epoch,timestamp} from '@devmesh/contracts';
import type {ConversationSummary,ConversationMessage} from '@devmesh/contracts';
import {ConversationWorkDetails} from './conversation-work-context.js';
import type {WorkContext} from './conversation-work-context.js';
import {WorkbenchDelivery} from './workbench-delivery.js';
import type {DeliveryReading} from './workbench-delivery.js';
import {WorkbenchIcon as Icon} from './workbench-icons.js';
import {ConversationText} from './conversation-text.js';

export const conversationDetailTabs=['任务','协作','成果','预览','记录'] as const;
export type ConversationDetailTab=(typeof conversationDetailTabs)[number];
type Read=(path:string)=>Promise<unknown>;
const changesView=z.looseObject({changes:z.array(z.looseObject({changeId:ids.change,runId:ids.run,state:opaqueKey,proposedText:z.string().max(20000)})).max(100)});
const configsView=z.looseObject({adjustments:z.array(z.looseObject({adjustmentId:opaqueKey,runId:ids.run,state:opaqueKey})).max(100)});
const generationView=z.looseObject({generation:epoch});
const eventsView=z.strictObject({events:z.array(z.looseObject({eventId:opaqueKey,projectId:ids.project,runId:ids.run,seq:epoch,type:opaqueKey,observedAt:timestamp})).max(200),nextCursor:epoch});
type DetailData={workspace:z.output<typeof workspaceView>;collaboration:{changes:z.output<typeof changesView>['changes'];configs:z.output<typeof configsView>['adjustments'];generation:number}|null;events:z.output<typeof eventsView>['events']};
const eventNames:Record<string,string>={InputSaved:'输入已保存',RequirementPublished:'需求已整理',RequirementsPublished:'需求已整理',PlanPublished:'方案已保存',PlanConfirmed:'方案已确认',WorkAdmitted:'工作已进入执行',AttemptTransitioned:'工作状态已更新',ReleaseAccepted:'交付已接受',ControlProgress:'任务控制状态已更新'};
const decisions:Record<string,string>={PROPOSED:'待审阅',CONFIRMED:'已确认',APPLIED:'已应用',REJECTED:'已拒绝',SUPERSEDED:'已由新版本替代'};
const clock=(value:string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));

function useDetailData(current:ConversationSummary|undefined,tab:ConversationDetailTab,open:boolean,read:Read){
 const [result,setResult]=useState<{data:DetailData|null;problem:boolean}>({data:null,problem:false}),[reload,setReload]=useState(0),reader=useRef(read);reader.current=read;
 const projectId=current?.projectId,runId=current?.runId;
 useEffect(()=>{setResult({data:null,problem:false});if(!open||!projectId||!runId||tab==='任务')return;let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;const abort=new AbortController();
  const load=async()=>{try{
   const workspace=workspaceView.parse(await reader.current('/api/v1/projects/'+encodeURIComponent(projectId)+'/workspace?runId='+encodeURIComponent(runId)+'&limit=1'));
   if(workspace.project.projectId!==projectId||workspace.run.runId!==runId)throw Error('Wrong execution context');
   let collaboration:DetailData['collaboration']=null,events:DetailData['events']=[];
   if(tab==='协作'){
    const [changes,configs,generation]=await Promise.all([reader.current('/api/v1/runs/'+encodeURIComponent(runId)+'/changes?limit=50').then(v=>changesView.parse(v)),reader.current('/api/v1/runs/'+encodeURIComponent(runId)+'/config-adjustments?limit=50').then(v=>configsView.parse(v)),reader.current('/api/v1/config/generation?runId='+encodeURIComponent(runId)).then(v=>generationView.parse(v))]);
    if(changes.changes.some(c=>c.runId!==runId)||configs.adjustments.some(c=>c.runId!==runId))throw Error('Wrong collaboration context');collaboration={changes:changes.changes,configs:configs.adjustments,generation:generation.generation};
   }
   if(tab==='记录'){const saved=eventsView.parse(await reader.current('/api/v1/projects/'+encodeURIComponent(projectId)+'/runs/'+encodeURIComponent(runId)+'/events?afterSeq='+Math.max(0,workspace.eventCursor-50)+'&limit=50'));if(saved.events.some(e=>e.projectId!==projectId||e.runId!==runId))throw Error('Wrong event context');events=saved.events;}
   if(!stopped)setResult({data:{workspace,collaboration,events},problem:false});
  }catch{if(!stopped)setResult({data:null,problem:true});}if(!stopped)timer=setTimeout(()=>void load(),3000);};void load();return()=>{stopped=true;abort.abort();if(timer)clearTimeout(timer);};
 },[projectId,runId,tab,open,reload]);
 return {data:result.data,problem:result.problem,retry:()=>setReload(value=>value+1)};
}

export function ConversationDetails({current,context,contextError,messages,open,tab,onTab,read,beforeOpen,legacy}:{current:ConversationSummary|undefined;context:WorkContext|null;contextError:boolean;messages:ConversationMessage[];open:boolean;tab:ConversationDetailTab;onTab:(tab:ConversationDetailTab)=>void;read:Read;beforeOpen:()=>Promise<boolean>;legacy:string}){
 const uid=useId(),buttons=useRef<(HTMLButtonElement|null)[]>([]),[reading,setReading]=useState<DeliveryReading>({candidateId:null,candidateAfterRevision:0}),{data,problem,retry}=useDetailData(current,tab,open,read),bound=!!current?.projectId&&!!current.runId;
 async function external(path:string){if(!await beforeOpen())return false;window.open(path,'_blank','noopener,noreferrer');return true;}
 return <><div className="tabs conversation-detail-tabs" role="tablist" aria-label="执行信息">{conversationDetailTabs.map((name,index)=><button ref={element=>{buttons.current[index]=element;}} type="button" key={name} id={uid+'-tab-'+index} role="tab" aria-selected={name===tab} aria-controls={uid+'-panel'} tabIndex={name===tab?0:-1} onClick={()=>onTab(name)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?conversationDetailTabs.length-1:(index+(e.key==='ArrowLeft'?-1:1)+conversationDetailTabs.length)%conversationDetailTabs.length;onTab(conversationDetailTabs[next]!);buttons.current[next]?.focus();}}}><Icon name={(['task','team','artifact','preview','record'] as const)[index]!}/>{name}</button>)}</div>
 <section className="conversation-detail-panel" id={uid+'-panel'} role="tabpanel" aria-labelledby={uid+'-tab-'+conversationDetailTabs.indexOf(tab)}>
 {tab==='任务'&&(context?<ConversationWorkDetails context={context} legacy={legacy}/>:<p className="detail-empty">{bound?(contextError?'暂时无法核实本轮任务，正在重试。':'正在读取本轮任务…'):'描述需求并发起研发任务后，可在这里查看目标、方案与执行状态。'}</p>)}
 {open&&tab!=='任务'&&bound&&problem&&<div className="notice"><p role="alert">暂时无法读取本轮{tab}信息，请重试。</p><button onClick={retry}>重新读取{tab}</button></div>}
 {open&&tab!=='任务'&&bound&&!data&&!problem&&<p className="detail-empty" role="status">正在读取{tab}…</p>}
 {tab==='协作'&&<><h3>项目协作</h3>{data?<><p>当前角色：{({owner:'项目负责人',operator:'项目操作者',viewer:'只读成员'})[data.workspace.membership]}</p><p className="muted">项目成员权限决定可查看和提交的内容。</p>{context?.works.length? <section className="detail-section"><h4>当前分工</h4>{context.works.map(w=><article className="detail-work" key={w.workId}><p>{({product:'需求分析',architect:'方案设计',developer:'开发',tester:'验证'})[w.role]??'任务处理'} · {w.goal}</p></article>)}</section>:null}{data.collaboration&&<section className="detail-section" aria-label="变更与配置"><h4>变更与配置</h4><p className="muted">配置代际 {data.collaboration.generation}</p><p>变更提案 {data.collaboration.changes.length} 条 · 配置调整 {data.collaboration.configs.length} 条</p>{data.collaboration.changes.map(c=><article className="detail-work" key={c.changeId}><ConversationText text={c.proposedText}/><span className="muted">{decisions[c.state]??'状态待核对'}</span></article>)}{data.collaboration.configs.map(c=><p key={c.adjustmentId}>配置调整 · {decisions[c.state]??'状态待核对'}</p>)}{!data.collaboration.changes.length&&!data.collaboration.configs.length&&<p className="muted">本轮暂无变更提案或配置调整。</p>}</section>}</>:!bound&&<p className="detail-empty">任务关联项目后，将显示成员权限、工作分工和变更记录。</p>}</>}
 {(tab==='成果'||tab==='预览')&&(open&&data?<WorkbenchDelivery key={data.workspace.run.runId+':'+tab} workspace={data.workspace} read={read} reading={reading} onReading={setReading} before={beforeOpen} onOpen={external} focus={tab}/>:!bound&&<><h3>{tab==='成果'?'候选与交付成果':'候选预览'}</h3><p className="detail-empty">{tab==='成果'?'尚未产生交付成果。任务执行并保存候选后，会在这里显示。':'尚无可预览的候选。准备好候选后，可在这里进入预览与数据管理。'}</p></>)}
 {tab==='记录'&&<><h3>对话记录</h3>{messages.length?<ol className="conversation-detail-records">{messages.slice(-20).toReversed().map(m=><li key={m.messageId}><span className="muted">{clock(m.createdAt)} · {({user:'你',assistant:'DevMesh',progress:'任务进展'})[m.role]}</span><details><summary>{m.text.split('\n').find(line=>line.trim())?.replace(/^#+\s*/,'')||'附件输入'}</summary><ConversationText text={m.text}/>{m.attachmentIds.length>0&&<p className="muted">附件 {m.attachmentIds.length} 项</p>}</details></li>)}</ol>:<p className="detail-empty">尚无已保存的对话记录。</p>}{bound&&data&&<section className="detail-section"><h4>最近执行记录</h4>{data.events.length?<ol className="conversation-detail-records">{data.events.toReversed().map(e=><li key={e.eventId}><span className="muted">{clock(e.observedAt)}</span><p>{eventNames[e.type]??'执行记录已更新'}</p></li>)}</ol>:<p className="muted">本轮暂无执行记录。</p>}</section>}{bound&&<a href={legacy} target="_blank" rel="noreferrer">查看完整输入与技术记录 ↗</a>}</>}
 </section></>;
}
