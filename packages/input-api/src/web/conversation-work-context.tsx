import {useEffect,useRef,useState} from 'react';
import {conversationWorkContext} from '@devmesh/contracts';
import type {ConversationSummary} from '@devmesh/contracts';
import type {z} from 'zod';
import {ConversationText} from './conversation-text.js';
export type WorkContext=NonNullable<z.output<typeof conversationWorkContext>>;
type Read=(path:string)=>Promise<unknown>;
export const workRoles:Record<string,string>={product:'需求分析',architect:'方案设计',developer:'开发',tester:'验证'};
const roles=workRoles;
const phases:Record<string,string>={PREPARING:'准备任务',UNDERSTANDING:'理解需求',PLANNING:'整理方案',EXECUTING:'执行与验证',ACCEPTING:'审阅成果',COMPLETED:'已结束'};
const checks:Record<string,string>={'artifact-exists':'输出文件完整','schema-valid':'结果格式检查','commit-resolved':'代码变更可核实','command-exit-zero':'指定命令通过','required-tests-pass':'必要测试通过','coverage-threshold':'覆盖率达标','human-decision':'人工审阅'};
export const workStates:Record<string,string>={RESERVED:'等待派发',QUEUED:'排队中',RUNNING:'处理中',SUCCEEDED:'已完成',FAILED:'未通过',CANCELLED:'已取消',OUTCOME_UNKNOWN:'结果待核实',PAUSED:'已暂停',BLOCKED:'等待条件'};
export function useConversationWorkContext(current:ConversationSummary|undefined,read:Read,denied:boolean){
 const [snapshot,setSnapshot]=useState<{value:WorkContext|null;error:boolean}>({value:null,error:false}),reader=useRef(read);reader.current=read;
 const id=current?.conversationId,runId=current?.runId,inputRevision=current?.inputRevision;
 useEffect(()=>{setSnapshot({value:null,error:false});if(!id||!runId||denied)return;let stop=false;const abort=new AbortController();
  const poll=async()=>{while(!stop){try{const value=conversationWorkContext.parse(await reader.current('/api/v1/conversations/'+encodeURIComponent(id)+'/work-context'));if(!stop)setSnapshot({value:value?.run.runId===runId&&value.inputRevision===inputRevision?value:null,error:false});}catch{if(!stop)setSnapshot({value:null,error:true});}if(!stop)await new Promise<void>(resolve=>{const timer=setTimeout(resolve,1500);abort.signal.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});}};void poll();return()=>{stop=true;abort.abort();};
 },[id,runId,inputRevision,denied]);
 return {context:snapshot.value&&snapshot.value.conversationId===id&&snapshot.value.inputRevision===inputRevision&&!denied?snapshot.value:null,contextError:snapshot.error};
}
export function ConversationPlanCard({context,canWrite,busy,execution,onConfirm,onAdjust,onReview}:{context:WorkContext;canWrite:boolean;busy:boolean;execution:boolean;onConfirm:()=>void;onAdjust:()=>void;onReview:()=>void}){
 const review=context.plan;if(!review)return null;const confirmed=!!review.confirmation||!!review.executionAuthorization;
 return <section className="conversation-plan card" aria-label="当前方案"><div className="plan-heading"><span className="eyebrow">{confirmed?'当前方案':'请审阅方案'}</span><span className="plan-version">v{review.planRevision} · 需求 v{review.requirementRevision}</span></div><h2>{context.project.name}</h2>
 <ul className="plan-scope">{context.understanding.understanding?.requirements.slice(0,4).map(r=><li key={r.id}>{r.statement}</li>)}</ul>
 <div className="plan-work-summary">{review.plan.works.map(w=><span key={w.workId}>{roles[w.role]??w.role}</span>)}</div>
 {!execution&&<p className="plan-note">可以确认方案；代码运行与测试环境尚未连接，确认后仍需等待执行条件。</p>}
 {context.run.controlGate==='PAUSED'&&<p className="plan-note">任务已暂停，确认后仍保持暂停。</p>}
 {review.issues.length>0&&<p className="plan-note">方案检查有 {review.issues.length} 项待处理，请先查看完整方案。</p>}
 <div className="plan-actions">{!confirmed&&<button className="primary" disabled={!canWrite||busy||!review.canConfirm} onClick={onConfirm}>{execution&&context.run.controlGate==='OPEN'?'确认并开始':'确认方案'}</button>}{confirmed&&<span className="plan-confirmed">{review.confirmation?'方案已确认':'已按任务授权推进'}</span>}<button disabled={!canWrite||busy} onClick={onAdjust}>调整方案</button><button onClick={onReview}>查看完整方案</button></div></section>;
}
export function ConversationWorkDetails({context,legacy,planRequest=0,onConversation}:{context:WorkContext;legacy:string;planRequest?:number;onConversation?:()=>void}){
 const understanding=context.understanding.understanding,review=context.plan;
 const plan=useRef<HTMLDetailsElement|null>(null);
 useEffect(()=>{if(planRequest>0&&plan.current){plan.current.open=true;plan.current.scrollIntoView({block:'start'});}},[planRequest]);
 const questions=context.understanding.questions.filter(q=>q.state==='OPEN'),needsReview=review&&!review.confirmation&&!review.executionAuthorization;
 return <><section className="detail-section"><h3>本轮目标</h3><p>{context.project.name}</p><dl className="detail-facts"><dt>当前阶段</dt><dd>{phases[context.run.phase]??context.run.phase}</dd><dt>运行状态</dt><dd>{context.run.terminalOutcome??({OPEN:'可推进',PAUSED:'已暂停',PAUSING:'正在收尾',CANCELLING:'正在取消'}[context.run.controlGate]??context.run.controlGate)}</dd></dl></section>
 <section className="detail-section" aria-label="需要你处理"><h3>需要你处理</h3>{!questions.length&&!needsReview?<p className="muted">当前没有已知的澄清或方案待审阅项。</p>:<>
 {questions.map(q=><p key={q.questionId}>{q.content.required?'必答 · ':''}{q.content.prompt}</p>)}{needsReview&&<p>方案 v{review.planRevision} 等待审阅{review.issues.length?'，另有 '+review.issues.length+' 项计划检查待处理':''}。</p>}
 {onConversation&&<button onClick={onConversation}>{needsReview?'回到对话审阅方案':'回到对话补充说明'}</button>}</>}<p className="muted">此处汇总已保存的问题和方案状态；需求变更另列于下方。</p></section>
 <section className="detail-section"><h3>当前工作</h3>{context.works.length?context.works.map(w=><details className="detail-work" key={w.workId}><summary>{w.goal}<span className="detail-work-state">{roles[w.role]??w.role} · {w.state?workStates[w.state]??'正在核实状态':'尚未派发'}</span></summary>{w.blockedReason&&<><p>此工作需要处理执行条件。</p><p className="hash">原因代码：{w.blockedReason}</p></>}{review?.plan.works.filter(item=>item.workId===w.workId).map(item=><div key={item.workId}><p>涉及范围：{item.writeScope.join('、')||'分析与检查'}</p><p>完成检查：{item.completionChecks.map(c=>checks[c.kind]??c.kind).join('、')}</p></div>)}<p className="hash">{w.workId}</p></details>):<p className="muted">尚无已发布的工作项。</p>}</section>
 {understanding&&<details className="detail-section"><summary>需求与约定 · v{context.understanding.requirementRevision}</summary>{understanding.requirements.map(r=><div key={r.id}><ConversationText text={r.statement}/><ul>{r.acceptance.map((a,i)=><li key={i}>{a}</li>)}</ul></div>)}{understanding.assumptions.length>0&&<><h4>当前约定</h4><ul>{understanding.assumptions.map((a,i)=><li key={i}>{a}</li>)}</ul></>}</details>}
 {review&&<details ref={plan} id="conversation-full-plan" className="detail-section"><summary>完整方案 · v{review.planRevision}</summary>{review.plan.works.map(w=><article className="detail-work" key={w.workId}><span className="eyebrow">{roles[w.role]??w.role}</span><ConversationText text={w.goal}/><p className="muted">涉及范围：{w.writeScope.join('、')||'分析与检查'}</p><p className="muted">检查：{w.completionChecks.map(c=>checks[c.kind]??'结果检查').join('、')}</p></article>)}{review.issues.length>0&&<p className="plan-note">方案仍有 {review.issues.length} 项检查待处理，可在技术记录中核对具体原因。</p>}</details>}
 <a href={legacy} target="_blank" rel="noreferrer">查看原始资料、工作依赖与技术记录 ↗</a></>;
}
