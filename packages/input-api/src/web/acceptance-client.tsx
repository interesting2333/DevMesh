import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {z} from 'zod';
import {acceptanceBasisView,acceptancePreparationView,acceptancePreparationList,acceptanceCandidateBasis,beginAcceptanceInput,confirmAcceptanceReplacementInput,closeUnsentAcceptanceInput,abortAcceptanceInput,acceptCandidateInput,acceptanceReplacementReceipt,acceptanceAbortReceipt,acceptanceCommitReceipt,ids,strongETag} from '@devmesh/contracts';

type Basis=z.output<typeof acceptanceBasisView>;
type Preparation=z.output<typeof acceptancePreparationView>;
type History=z.output<typeof acceptancePreparationList>;
const envelope={key:z.uuid(),runId:ids.run,candidateId:ids.candidate,ifMatch:strongETag};
const pendingSchema=z.discriminatedUnion('kind',[
  z.strictObject({...envelope,kind:z.literal('prepare'),body:beginAcceptanceInput}),
  z.strictObject({...envelope,kind:z.literal('replace'),body:confirmAcceptanceReplacementInput}),
  z.strictObject({...envelope,kind:z.literal('close'),operationId:ids.operation,body:closeUnsentAcceptanceInput}),
  z.strictObject({...envelope,kind:z.literal('abort'),operationId:ids.operation,body:abortAcceptanceInput}),
  z.strictObject({...envelope,kind:z.literal('accept'),body:acceptCandidateInput}),
]).refine(p=>p.kind!=='accept'||p.body.runId===p.runId);
type Pending=z.output<typeof pendingSchema>;
const actions:Record<Pending['kind'],string>={prepare:'准备接受',replace:'确认替换数据',close:'关闭未派发准备',abort:'撤销接受准备',accept:'最终接受'};
const reasons:Record<NonNullable<Basis['reason']>,string>={NOT_OWNER:'仅当前 Run 负责人可以确认。',REVIEW_REQUIRED:'请先完成准确候选的逐项审查。',CANDIDATE_STALE:'此候选已过期，请返回当前候选。',SOURCE_CHANGED:'当前接受指针与方案来源已不同，请核对新方案。',BACKEND_UNAVAILABLE:'接受后端尚未配置或当前方案不受支持。',REPLACEMENT_CONFIRMATION_REQUIRED:'此方案需要单独确认替换数据。',PREPARATION_UNRESOLVED:'项目已有未决准备，请先核实原准备。',EFFECT_UNRESOLVED:'项目仍有未核实的外部操作。'};
const resolutions:Record<Preparation['resolution'],string>={UNRESOLVED:'准备尚未结束',UNSENT_FAILED:'未派发准备已关闭',COMMITTED:'版本已接受',ABORTING:'撤销决定已记录 · 清理待核实',ABORTED:'原准备已撤销'};
const dispatches:Record<Preparation['state'],string>={PREPARED:'尚未派发',SENT:'已派发',UNKNOWN:'派发结果待核实',FAILED:'未派发关闭'};
const readiness:Record<Preparation['readiness']['state'],string>={UNPREPARED:'尚未就绪',READY:'当前观察就绪',UNAVAILABLE:'暂时无法核实就绪',STALE:'就绪依据已过期'};
const time=(v:string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
class ApiError extends Error{constructor(readonly status:number,readonly write:boolean){super('Acceptance request unavailable');}}
const candidatePath=(runId:string,candidateId:string)=>'/api/v1/runs/'+encodeURIComponent(runId)+'/candidates/'+encodeURIComponent(candidateId);
const fixedBasis=(b:Basis)=>acceptanceCandidateBasis.parse(Object.fromEntries(['candidateRevision','manifestHash','reviewHash','expectedAcceptedReleaseId','dataPlanHash'].map(k=>[k,b[k as keyof Basis]])));

function DataPlan({basis}:{basis:Basis}){
  const plan=basis.dataPlan;
  return <section className="card" aria-label="固定数据方案"><h2>本次使用的数据</h2>
    {plan.strategy==='INITIAL'?<p>首次初始化 · {plan.initialData==='EMPTY'?'空数据':'演示数据'}</p>:plan.strategy==='PRESERVE_MIGRATE'?<><p>保留原业务数据，并执行此版本固定的迁移。</p><p className="hash">迁移材料：{plan.migrationRef.artifactId}<br/>{plan.migrationRef.sha256}</p></>:<p className="notice">替换原业务数据 · {plan.initialData==='EMPTY'?'重新建立空数据':'重新建立演示数据'}。此方案需要独立确认。</p>}
    <dl><dt>方案来源版本</dt><dd>{plan.sourceReleaseId??'无 · 首次初始化'}</dd><dt>冻结接受指针</dt><dd>{basis.expectedAcceptedReleaseId??'无'}</dd><dt>当前接受指针</dt><dd>{basis.currentAcceptedReleaseId??'无'}</dd></dl>
    <p className="muted">数据方案已随候选固定。如需改变策略，请重新形成候选并审查。</p>
  </section>;
}

function Acceptance({initial}:{initial:Basis}){
  const path=candidatePath(initial.runId,initial.candidateId),base=path+'/acceptance',storageKey='devmesh.acceptance.pending:'+initial.runId;
  const [basis,setBasis]=useState<Basis|null>(initial),[preparation,setPreparation]=useState<Preparation|null>(null),[history,setHistory]=useState<History|null>(null);
  const [cursor,setCursor]=useState(0),[previous,setPrevious]=useState<number[]>([]),[busy,setBusy]=useState(false),[stale,setStale]=useState(true),[denied,setDenied]=useState(false),[message,setMessage]=useState(''),[abandon,setAbandon]=useState(false);
  const [confirmPrepare,setConfirmPrepare]=useState(false),[confirmReplace,setConfirmReplace]=useState(false),[confirmClose,setConfirmClose]=useState(false),[confirmAbort,setConfirmAbort]=useState(false),[confirmAccept,setConfirmAccept]=useState(false),[abortReason,setAbortReason]=useState('');
  const [receipt,setReceipt]=useState<z.output<typeof acceptanceCommitReceipt>|null>(null);
  const [stored]=useState<{pending:Pending|null;invalid:boolean}>(()=>{try{const raw=sessionStorage.getItem(storageKey),p=raw?pendingSchema.parse(JSON.parse(raw)):null;if(p&&p.runId!==initial.runId)throw Error('Wrong Run');return {pending:p,invalid:false};}catch{return {pending:null,invalid:true};}});
  const [pending,setPending]=useState<Pending|null>(stored.pending),[invalidPending,setInvalidPending]=useState(stored.invalid);
  const lock=useRef(false),disposed=useRef(false),controllers=useRef(new Set<AbortController>());
  function resetConsent(){setConfirmPrepare(false);setConfirmReplace(false);setConfirmClose(false);setConfirmAbort(false);setConfirmAccept(false);setAbortReason('');}
  useEffect(()=>{
    const stop=()=>{disposed.current=true;for(const c of controllers.current)c.abort();},restore=(event:PageTransitionEvent)=>{if(event.persisted)location.reload();};
    window.addEventListener('pagehide',stop);window.addEventListener('pageshow',restore);
    void run(()=>load());
    return()=>{stop();window.removeEventListener('pagehide',stop);window.removeEventListener('pageshow',restore);};
  },[]);
  async function request(url:string,init:RequestInit={}){
    const controller=new AbortController();controllers.current.add(controller);
    try{const response=await fetch(url,{...init,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});if(!response.ok)throw new ApiError(response.status,init.method==='POST');if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Invalid response');return await response.json() as unknown;}finally{controllers.current.delete(controller);}
  }
  function failure(error:unknown){
    if(disposed.current)return;setStale(true);resetConsent();
    if(error instanceof ApiError&&[401,403,404].includes(error.status)){setDenied(true);setBasis(null);setPreparation(null);setHistory(null);setReceipt(null);setMessage('访问权限已失效，请重新进入或联系项目负责人。');}
    else if(error instanceof ApiError&&error.write&&[409,412,422,428].includes(error.status)){setAbandon(true);setMessage('提交依据已变化或不满足条件。请刷新核对原记录，再决定是否放弃本次填写。');}
    else setMessage('暂时无法核实结果；请保留原请求，刷新状态或核实原提交。');
  }
  async function run(action:()=>Promise<void>){if(lock.current||disposed.current)return;lock.current=true;setBusy(true);try{await action();}catch(error){failure(error);}finally{lock.current=false;if(!disposed.current)setBusy(false);}}
  function exact(p:Preparation,candidateId=initial.candidateId){if(p.runId!==initial.runId||p.candidateId!==candidateId)throw Error('Wrong preparation');return p;}
  async function load(selectedId:string|undefined=preparation?.operationId,after=cursor,prev=previous){
    resetConsent();
    const b=acceptanceBasisView.parse(await request(base));if(b.runId!==initial.runId||b.candidateId!==initial.candidateId)throw Error('Wrong candidate');
    const h=acceptancePreparationList.parse(await request(base+'/preparations?limit=20&afterSequence='+after));h.items.forEach(item=>exact(item.preparation));
    const selected=selectedId??h.items.find(item=>item.preparation.operationId===b.blockedByPreparationOperationId)?.preparation.operationId??h.items.at(-1)?.preparation.operationId;
    const p=selected?exact(acceptancePreparationView.parse(await request(base+'/preparations/'+encodeURIComponent(selected)))):null;
    if(disposed.current)return;setBasis(b);setHistory(h);setPreparation(p);setCursor(after);setPrevious(prev);setStale(false);setMessage('');
  }
  async function select(operationId:string){await load(operationId);}
  async function submit(original:Pending){
    const root=candidatePath(original.runId,original.candidateId)+'/acceptance';
    const url=original.kind==='accept'?'/api/v1/candidates/'+encodeURIComponent(original.candidateId)+':accept':original.kind==='prepare'?root+'/preparations':original.kind==='replace'?root+'/replacement-confirmations':root+'/preparations/'+encodeURIComponent(original.operationId)+(original.kind==='close'?'/close-unsent':'/abort');
    const value=await request(url,{method:'POST',headers:{'content-type':'application/json','idempotency-key':original.key,'if-match':original.ifMatch},body:JSON.stringify(original.body)});
    let selectedId:string|undefined,accepted:z.output<typeof acceptanceCommitReceipt>|undefined;
    if(original.kind==='prepare'||original.kind==='close'){
      const p=exact(acceptancePreparationView.parse(value),original.candidateId);
      if(original.kind==='close'?(p.operationId!==original.operationId||p.requestHash!==original.body.requestHash):Object.entries(original.body).some(([k,v])=>k!=='policyHash'&&p.basis[k as keyof typeof p.basis]!==v))throw Error('Wrong original result');
      selectedId=p.operationId;
    }else if(original.kind==='replace'){
      if(acceptanceReplacementReceipt.parse(value).decisionId!==original.body.decisionId)throw Error('Wrong decision');
    }else if(original.kind==='abort'){
      const r=acceptanceAbortReceipt.parse(value);if(r.preparationOperationId!==original.operationId||r.reason!==original.body.reason)throw Error('Wrong abort');selectedId=original.operationId;
    }else{
      accepted=acceptanceCommitReceipt.parse(value);const r=accepted.result,b=original.body;
      if(r.runId!==original.runId||r.candidateId!==original.candidateId||r.preparationOperationId!==b.preparationOperationId||r.requestHash!==b.requestHash||r.proofHash!==b.proofHash||r.manifestHash!==b.manifestHash||r.reviewHash!==b.reviewHash||r.candidateRevision!==b.candidateRevision||r.previousReleaseId!==b.expectedAcceptedReleaseId||r.acceptanceOperationId!==accepted.operationId)throw Error('Wrong acceptance');selectedId=b.preparationOperationId;
    }
    if(disposed.current)return;
    sessionStorage.removeItem(storageKey);setPending(null);setAbandon(false);resetConsent();
    if(accepted)setReceipt(accepted);
    await load(original.candidateId===initial.candidateId?selectedId:undefined);
    setMessage(original.kind==='accept'?'原接受已核实并保存。发布状态请进入已接受版本查看。':original.kind==='abort'?'原撤销决定已保存，清理完成情况请核实原准备。':'原提交已核实并保存，当前状态已刷新。');
  }
  function save(input:Record<string,unknown>){
    if(!basis||busy||stale||denied||pending||invalidPending)return;
    void run(async()=>{
      const value=pendingSchema.parse({...input,key:crypto.randomUUID(),runId:initial.runId,candidateId:initial.candidateId,ifMatch:'"r'+('operationId' in input||input.kind==='accept'?preparation!.resourceRevision:basis.resourceRevision)+'"'});
      try{if(sessionStorage.getItem(storageKey)!==null){setInvalidPending(true);setMessage('已有未核实记录，请重新进入并核对原请求。');return;}sessionStorage.setItem(storageKey,JSON.stringify(value));}catch{setInvalidPending(true);setMessage('浏览器无法保存原请求，请恢复会话存储后重新进入。');return;}
      setPending(value);setAbandon(false);resetConsent();await submit(value);
    });
  }
  function clearPending(){try{sessionStorage.removeItem(storageKey);setPending(null);setInvalidPending(false);setAbandon(false);resetConsent();setMessage('已清除本次填写，请根据当前记录重新核对。');}catch{setMessage('无法清除本次填写，请检查浏览器会话存储。');}}
  const disabled=busy||stale||denied||pending!==null||invalidPending;
  return <main>
    <nav className="row"><strong>DevMesh</strong><div className="actions">{!denied&&<a href={path+'/review/view'}>返回逐项审查</a>}<button disabled={busy||denied} onClick={()=>void run(()=>load())}>刷新接受状态</button></div></nav>
    <h1>核对数据，再接受版本。</h1><p className="muted">先固定接受依据并准备数据与服务。准备就绪后，还需要你单独确认最终接受。</p>
    {message&&<p className="notice" role="status">{message}</p>}
    {invalidPending&&!denied&&<section className="notice"><p>上次请求记录无法读取。请先刷新核对准备历史和当前接受版本。</p><button disabled={busy||stale} onClick={clearPending}>核对后清除此填写记录</button></section>}
    {pending&&!denied&&<section className="notice" aria-label="待核实提交"><h2>保留原请求：{actions[pending.kind]}</h2><p>结果尚未核实。继续核实会使用原正文、原键和原版本条件。</p><p className="hash">原候选：{pending.candidateId}</p>{pending.candidateId!==initial.candidateId&&<a href={candidatePath(pending.runId,pending.candidateId)+'/acceptance/view'}>查看原候选接受依据</a>}<div className="actions"><button disabled={busy} onClick={()=>void run(()=>submit(pending))}>核实原提交</button>{abandon&&<button disabled={busy||stale} onClick={clearPending}>核对后放弃本次填写</button>}</div></section>}
    {basis&&<>
      <section className="version"><div className="row"><strong>{basis.qualification==='CURRENT'?'当前候选':'已过期候选'}</strong><span className="badge">候选修订 {basis.candidateRevision}</span></div><p className="hash">代码提交：{basis.codeCommit}</p><details><summary>查看固定依据摘要</summary><p className="hash">材料：{basis.manifestHash}<br/>审查：{basis.reviewHash}<br/>数据方案：{basis.dataPlanHash}</p></details>{basis.reason&&<p>{reasons[basis.reason]}</p>}{basis.blockedByPreparationOperationId&&<p className="hash">项目未决准备：{basis.blockedByPreparationOperationId}</p>}</section>
      <DataPlan basis={basis}/>
      {basis.dataPlan.strategy==='REPLACE'&&<section className="card" aria-label="替换确认"><h2>单独确认数据替换</h2>{basis.replacementConfirmed?<p>此候选的数据替换决定已记录。</p>:<><p>确认将使用此方案中的{basis.dataPlan.initialData==='EMPTY'?'空数据':'演示数据'}替换来源版本的数据。此决定只适用于当前固定候选与方案。</p><label><input type="checkbox" checked={confirmReplace} disabled={disabled||!basis.canConfirmReplacement} onChange={e=>setConfirmReplace(e.target.checked)}/>我已核对来源版本，同意此候选替换数据</label><button disabled={disabled||!basis.canConfirmReplacement||!confirmReplace} onClick={()=>save({kind:'replace',body:confirmAcceptanceReplacementInput.parse({...fixedBasis(basis),decisionId:basis.dataPlan.replacementDecisionId,confirmation:'REPLACE_ACCEPTED_DATA'})})}>确认替换数据</button></>}</section>}
      <section className="card" aria-label="准备接受"><h2>1. 准备接受</h2><p>保存固定依据，等待可信后端准备准确的数据和只读服务。</p><label><input type="checkbox" checked={confirmPrepare} disabled={disabled||!basis.canPrepare} onChange={e=>setConfirmPrepare(e.target.checked)}/>我已核对候选、数据方案和来源版本</label><button className="primary" disabled={disabled||!basis.canPrepare||!confirmPrepare} onClick={()=>save({kind:'prepare',body:beginAcceptanceInput.parse({...fixedBasis(basis),policyHash:basis.policyHash})})}>创建接受准备</button></section>
    </>}
    {preparation&&<section className="card" aria-label="原接受准备"><div className="row"><h2>2. 核实原准备</h2><span className="badge">{resolutions[preparation.resolution]}</span></div><p className="hash">{preparation.operationId}</p><dl><dt>派发记录</dt><dd>{dispatches[preparation.state]}</dd><dt>当前就绪观察</dt><dd>{readiness[preparation.readiness.state]}</dd><dt>候选依据</dt><dd>{preparation.qualification==='CURRENT'?'当前有效':'已过期'}</dd><dt>创建时间</dt><dd>{time(preparation.createdAt)}</dd></dl><details><summary>查看原准备依据摘要</summary><p className="hash">请求：{preparation.requestHash}<br/>材料：{preparation.basis.manifestHash}<br/>审查：{preparation.basis.reviewHash}<br/>数据方案：{preparation.basis.dataPlanHash}<br/>原接受指针：{preparation.basis.expectedAcceptedReleaseId??'无'}<br/>凭证：{preparation.readiness.proofHash??'尚无'}</p></details>
      {preparation.resolution==='UNRESOLVED'&&<p className="muted">刷新仅查询原准备。后端未配置或尚未核实就绪时，最终接受保持关闭。</p>}
      {preparation.resolution==='ABORTING'&&<p className="notice">撤销决定已记录。原实例清理、数据撤权和来源恢复仍需核实；此状态不表示清理完成。</p>}
      {preparation.canCloseUnsent&&<><label><input type="checkbox" checked={confirmClose} disabled={disabled} onChange={e=>setConfirmClose(e.target.checked)}/>确认关闭这个尚未派发的准备</label><button disabled={disabled||!confirmClose} onClick={()=>save({kind:'close',operationId:preparation.operationId,body:{requestHash:preparation.requestHash}})}>关闭未派发准备</button></>}
      {preparation.canAbort&&<><label>撤销理由<textarea maxLength={2000} value={abortReason} disabled={disabled} onChange={e=>setAbortReason(e.target.value)}/></label><label><input type="checkbox" checked={confirmAbort} disabled={disabled} onChange={e=>setConfirmAbort(e.target.checked)}/>确认撤销这个已派发的原准备，并等待清理核实</label><button disabled={disabled||!confirmAbort||!abortReason.trim()} onClick={()=>save({kind:'abort',operationId:preparation.operationId,body:abortAcceptanceInput.parse({requestHash:preparation.requestHash,expectedPreparationRevision:preparation.revision,reason:abortReason,confirmation:'ABORT_ACCEPTANCE_PREPARATION'})})}>记录撤销决定</button></>}
      {preparation.resolution==='UNRESOLVED'&&<section aria-label="最终接受"><h2>3. 最终接受</h2><p>接受会保存此准备对应的不可变版本并结束本次 Run，之后继续独立发布。</p><label><input type="checkbox" checked={confirmAccept} disabled={disabled||!preparation.canCommit} onChange={e=>setConfirmAccept(e.target.checked)}/>我已检查此原准备及就绪依据，确认接受这个版本</label><button className="primary" disabled={disabled||!preparation.canCommit||!confirmAccept} onClick={()=>save({kind:'accept',body:acceptCandidateInput.parse({...preparation.basis,runId:preparation.runId,preparationOperationId:preparation.operationId,requestHash:preparation.requestHash,expectedPreparationRevision:preparation.revision,expectedObservationSequence:preparation.readiness.sequence,proofHash:preparation.readiness.proofHash,confirmation:'ACCEPT_RELEASE'})})}>接受此版本</button></section>}
      {preparation.resolution==='COMMITTED'&&<div className="actions"><a href={'/api/v1/runs/'+encodeURIComponent(preparation.runId)+'/releases/'+encodeURIComponent(preparation.releaseId)+'/view'}>查看已接受版本与当前发布状态</a><a href={'/api/v1/releases/'+encodeURIComponent(preparation.releaseId)+'/exports/view'}>导出已接受版本</a></div>}
    </section>}
    {receipt&&<section className="version" aria-label="原接受回执"><h2>原接受已确认</h2><p className="hash">{receipt.result.releaseId}</p><p>{time(receipt.result.acceptedAt)} · {receipt.result.acceptedBy}</p><p>原接受回执的发布状态：待发布。当前发布进度请进入已接受版本查看。</p></section>}
    {history&&<section className="card" aria-label="准备历史"><h2>准备历史</h2>{!history.items.length&&<p>此候选尚无接受准备。</p>}{history.items.map(({preparation:p})=><article className={'history'+(p.operationId===preparation?.operationId?' selected':'')} key={p.operationId}><p className="hash">{p.operationId}</p><p>{time(p.createdAt)} · {resolutions[p.resolution]}</p><button disabled={busy||denied} onClick={()=>void run(()=>select(p.operationId))}>查看此原准备</button></article>)}<div className="actions"><button disabled={busy||!previous.length||denied} onClick={()=>void run(()=>load(preparation?.operationId,previous.at(-1)??0,previous.slice(0,-1)))}>上一页准备</button><button disabled={busy||history.nextSequence===null||denied} onClick={()=>void run(()=>load(preparation?.operationId,history.nextSequence!,[...previous,cursor]))}>下一页准备</button></div></section>}
  </main>;
}

const root=document.getElementById('root')!;
try{createRoot(root).render(<Acceptance initial={acceptanceBasisView.parse(JSON.parse(document.getElementById('acceptance-data')?.textContent??''))}/>);}catch{root.textContent='接受依据无法加载，请刷新页面重试。';}
