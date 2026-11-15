import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {MutableRefObject} from 'react';
import {z} from 'zod';
import {workspaceView,ids,opaqueKey,inputOperation,operationReceipt,createProjectInput,saveMessageInput} from '@devmesh/contracts';
import {workbenchBoot} from './workbench-context.js';
import type {WorkbenchBoot,WorkbenchSelection} from './workbench-context.js';
import {openWorkbenchLocal} from './workbench-local.js';
import {CloseOriginal,verifyStaleOriginal,CloseRemovedOriginal,verifyRemovedOriginal} from './workbench-original.js';
import type {DraftContext,LocalCommand,LocalDraft} from './workbench-local.js';
import {WorkbenchApiError as ApiError} from './workbench-api.js';
import {WorkbenchPlanning} from './workbench-planning.js';
import {WorkbenchRecovery} from './workbench-recovery.js';

type Workspace=z.output<typeof workspaceView>;
type Store=Awaited<ReturnType<typeof openWorkbenchLocal>>;
type Api=(path:string,init?:RequestInit)=>Promise<unknown>;
const projectsPage=z.strictObject({projects:z.array(z.strictObject({projectId:ids.project,name:z.string(),updatedAt:z.string(),membership:opaqueKey})).max(100),nextCursor:z.string().nullable()});
const tabs=['任务','协作','成果','预览','记录'] as const;
const clock=(value:string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const draftKey=(c:DraftContext)=>JSON.stringify(c);

function Composer({context,api,guard,onConfirmed}:{context:Extract<DraftContext,{form:'project'|'message'}>;api:Api;guard:MutableRefObject<()=>Promise<boolean>>;onConfirmed:(selection:WorkbenchSelection)=>Promise<void>}){
 const [fields,setFields]=useState({text:'',name:''}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('正在读取本机草稿…'),[problem,setProblem]=useState(''),[pending,setPending]=useState<LocalCommand|null>(null),[references,setReferences]=useState<{items:LocalDraft[];nextCursor:string|null}>({items:[],nextCursor:null}),[discard,setDiscard]=useState(false),[closed,setClosed]=useState(false),[closedCommand,setClosedCommand]=useState<LocalCommand|null>(null),[history,setHistory]=useState<Awaited<ReturnType<Store['closedHistory']>>>({items:[],nextCursor:null}),[historyContext,setHistoryContext]=useState<DraftContext>(context);
 const currentDraft=useRef<LocalDraft|null>(null),local=useRef<Store|null>(null),latest=useRef(fields),revision=useRef(0),dirty=useRef(false),serial=useRef(0),failed=useRef(false),pumping=useRef(false),queue=useRef(Promise.resolve()),working=useRef(false),original=useRef<LocalCommand|null>(null),disposed=useRef(false),composition=useRef(false);
 function localFailure(e:unknown){failed.current=true;if(disposed.current)return;setProblem(e&&typeof e==='object'&&'code'in e&&e.code==='LOCAL_CONFLICT'?'另一页已修改这份草稿。本页修改仍保留，请读取并核对后再选择。':'本页输入尚未保存。请重试；离开前需成功保存或明确放弃未保存的修改。');setStatus('尚未保存在本机');}
 function hydrate(value:Awaited<ReturnType<Store['load']>>){
  currentDraft.current=value.draft;setClosedCommand(null);const f={text:value.draft?.text??'',name:value.draft?.name??''};latest.current=f;revision.current=value.draft?.revision??0;dirty.current=false;failed.current=false;original.current=value.pending;setFields(f);setPending(value.pending);setClosed(!!value.draft?.closedKey);setProblem('');setDiscard(false);setStatus(value.pending?'原提交结果待核实':value.draft?.closedKey?'此依据的原提交已关闭，旧草稿保留。请切换当前依据。':value.draft?'草稿已保存在本机':'尚未填写');
 }
 async function initialize(preserve=false){
  await queue.current;
  const store=await openWorkbenchLocal(context.principalId);if(disposed.current){store.close();return;}
  try{
   const value=await store.load(context);if(disposed.current){store.close();return;}
   local.current?.close();local.current=store;
   if(preserve&&dirty.current){
    if(value.pending){original.current=value.pending;setPending(value.pending);throw Error('Pending command');}
    if((value.draft?.revision??0)!==revision.current)throw Object.assign(Error('Conflict'),{code:'LOCAL_CONFLICT'});
    failed.current=false;setProblem('');schedule();await queue.current;
   }else hydrate(value);
   if(context.form==='message'){const refs=await store.references(context);if(!disposed.current)setReferences(refs);}
   const savedHistory=await store.closedHistory(context),savedClosed=value.draft?.closedKey?await store.getCommand(value.draft.closedKey):null;if(!disposed.current){setHistory(savedHistory);setHistoryContext(context);setClosedCommand(savedClosed);}
  }catch(e){if(local.current!==store)store.close();throw e;}
 }
 function schedule(){
  if(pumping.current||failed.current||original.current||!local.current)return;
  pumping.current=true;
  queue.current=(async()=>{
   while(dirty.current&&!failed.current&&!original.current&&!disposed.current){
    const at=serial.current,values={...latest.current};
    try{const saved=await local.current!.save(context,revision.current,values);revision.current=saved.revision;if(at===serial.current)dirty.current=false;if(!disposed.current)setStatus(dirty.current?'正在保存草稿…':'草稿已保存在本机');}
    catch(e){localFailure(e);}
   }
  })().finally(()=>{pumping.current=false;});
 }
 function edit(patch:Partial<typeof fields>){latest.current={...latest.current,...patch};dirty.current=true;serial.current++;setFields(latest.current);setDiscard(false);setStatus('正在保存草稿…');schedule();}
 async function flush(){await queue.current;if(dirty.current&&!failed.current){schedule();await queue.current;}return !dirty.current&&!failed.current;}
 useEffect(()=>{
  disposed.current=false;guard.current=async()=>{if(working.current)return false;return flush();};
  const before=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',before);
  void initialize().catch(localFailure).finally(()=>{if(!disposed.current)setReady(true);});
  return()=>{disposed.current=true;guard.current=async()=>true;window.removeEventListener('beforeunload',before);void queue.current.finally(()=>local.current?.close());};
 },[]);
 function commandFailure(e:unknown){
  if(disposed.current)return;
  if(!original.current){setProblem('输入尚未提交。请核对正文长度与内容，或重新读取本机草稿后重试。');return;}
  setProblem(e instanceof ApiError&&[409,412,422,428].includes(e.status)?'原请求的依据或内容已不适用。记录已保留；请先核实原提交，不能改用新请求替代它。':'暂时无法核实提交结果。原请求已保留，请核实原提交。');
 }
 async function exclusive(work:()=>Promise<void>){if(working.current||disposed.current)return;working.current=true;setBusy(true);try{await work();}catch(e){commandFailure(e);}finally{working.current=false;if(!disposed.current)setBusy(false);}}
 async function accept(command:LocalCommand,value:unknown){
  const parsed=z.union([inputOperation,operationReceipt]).parse(value),observed=await local.current!.observe(command.key,parsed);
  if(disposed.current)return;
  if(observed.receipt?.status!=='SUCCEEDED'){setPending(observed);original.current=observed;setProblem('原操作仍待核实，请保留原记录。');return;}
  const result=z.object({projectId:ids.project,runId:ids.run}).parse(observed.receipt.result);hydrate(await local.current!.load(context));setStatus('输入已提交保存；后台处理结果另行更新。');
  working.current=false;await onConfirmed(result);
 }
 async function send(command:LocalCommand){
  const e=command.envelope,value=await api(e.path,{method:'POST',headers:{'content-type':'application/json','idempotency-key':e.key,...(e.ifMatch?{'if-match':e.ifMatch}:{})},body:JSON.stringify(e.body)});await accept(command,value);
 }
  async function closeOriginal(){const p=original.current!;let committed=false;try{const verified=await verifyStaleOriginal(p,path=>api(path));if(verified.kind==='operation'){await accept(p,verified.value);return;}await local.current!.closeStale(p,verified.proof);committed=true;hydrate(await local.current!.load(context));setStatus('过期原提交已核实关闭，旧草稿仍保留。');const c=p.envelope.context;if(c.form==='project')throw Error('Wrong closure');working.current=false;await onConfirmed({projectId:c.projectId,runId:c.runId});}catch{setProblem(committed?'关闭已保存在本机，但当前执行尚未刷新，请重新进入。':'尚不能关闭原提交。请核实当前权限、执行依据及原操作；原记录继续保留。');}}
 async function closeRemoved(){
  const p=original.current!;let committed=false;
  try{
   const d=(await local.current!.load(p.envelope.context)).draft;if(!d)throw Error('Missing original draft');
   const verified=await verifyRemovedOriginal(p,path=>api(path));if(verified.kind==='operation'){await accept(p,verified.value);return;}
   const saved=await local.current!.closeRemoved(p,d,verified.proof);committed=true;original.current=null;currentDraft.current=null;setPending(null);setClosed(true);setClosedCommand(saved);setReady(false);
   await initialize();setStatus('已核实附件移除并关闭原提交，原内容保留。');
  }catch{setProblem(committed?'关闭已保存在本机，但记录尚未重新读到，请重试读取或重新进入。':'尚不能关闭原提交。请核实附件、权限及原操作；原记录继续保留。');}
  finally{if(committed&&!disposed.current)setReady(true);}
 }
 async function startBlank(){
  if(!closedCommand||!currentDraft.current)return;
  try{await local.current!.startBlankInput(closedCommand,currentDraft.current);await initialize();setStatus('已开始空白输入，原请求仍在已关闭记录中。');}
  catch{setProblem('尚不能开始空白输入，另一页可能已更新记录。请重新读取；原请求仍保留。');}
 }
 async function readHistory(c:DraftContext,more=false){const value=await local.current!.closedHistory(c,more?history.nextCursor??undefined:undefined);if(!disposed.current){setHistory(old=>({items:more?[...old.items,...value.items]:value.items,nextCursor:value.nextCursor}));setHistoryContext(c);}}
 function submit(){if(!ready||closed||original.current||failed.current)return;void exclusive(async()=>{
  if(!await flush()||!local.current)return;
  // Validate user input before creating an immutable pending original.
  const draft=(await local.current.load(context)).draft;if(!draft)throw Error('Missing draft');
  if(context.form==='project')createProjectInput.parse({initialRequest:{text:draft.text,attachmentIds:[]},clientDraftId:draft.clientDraftId,...(draft.name?{name:draft.name}:{})});
  else saveMessageInput.parse({text:draft.text,attachmentIds:[],clientMessageId:draft.clientDraftId});
  const q=await local.current.enqueue(context,revision.current);revision.current=q.draft.revision;original.current=q.command;setPending(q.command);setProblem('');setStatus('原请求已保存在本机，正在提交…');await send(q.command);
 });}
 async function lookup(){const p=original.current;if(!p||!local.current)return;await exclusive(async()=>{
  try{const value=await api('/api/v1/operations/lookup?scope='+encodeURIComponent(p.envelope.scope)+'&key='+encodeURIComponent(p.key));await accept(p,value);}
  catch(e){if(e instanceof ApiError&&e.status===404){setProblem('当前未查到原操作。请保留原记录；可明确使用同一原请求继续提交。');return;}throw e;}
 });}
 const disabled=!ready||busy||pending!==null||closed;
 return <section className="card composer" aria-label={context.form==='project'?'新项目输入':'补充输入'}>
  <h2>{context.form==='project'?'从一个需求开始':'补充说明或提问'}</h2>
  <form onSubmit={e=>{e.preventDefault();submit();}}>
   {context.form==='project'&&<><label htmlFor="project-name">项目名称（可选）</label><input id="project-name" maxLength={80} value={fields.name} disabled={disabled} onChange={e=>edit({name:e.target.value})}/></>}
   <label htmlFor="input-text">{context.form==='project'?'描述你想完成的事':'输入正文'}</label><textarea id="input-text" value={fields.text} maxLength={40000} disabled={disabled} onChange={e=>edit({text:e.target.value})} onCompositionStart={()=>{composition.current=true;}} onCompositionEnd={()=>{composition.current=false;}} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.repeat&&!e.nativeEvent.isComposing&&!composition.current){e.preventDefault();submit();}}}/>
   <p className="status" role="status">{status}</p>{problem&&<p role="alert" className="notice">{problem}</p>}
   <div className="actions"><button className="primary" type="submit" disabled={disabled||failed.current||!fields.text.trim()}>{context.form==='project'?'创建项目并保存需求':'提交输入'}</button><span className="muted">Enter 换行 · Ctrl / Cmd + Enter 提交</span></div>
  </form>
  {problem&&!pending&&<div className="actions"><button disabled={busy} onClick={()=>void exclusive(async()=>{try{await initialize(true);}catch(e){localFailure(e);}})}>重试本机保存</button><label><input type="checkbox" checked={discard} onChange={e=>setDiscard(e.target.checked)}/>我确认放弃本页未保存的修改</label><button disabled={busy||!discard} onClick={()=>void exclusive(async()=>{dirty.current=false;await initialize();})}>放弃本页修改并重新读取</button></div>}
   {pending&&<section className="notice" aria-label="待核实原提交"><h3>原提交结果待核实</h3><p>刷新或重新进入不会自动发送。核实会查询同一原操作，继续提交会使用原正文与原条件。</p><div className="actions"><button disabled={busy} onClick={()=>void lookup()}>核实原提交</button><button disabled={busy} onClick={()=>void exclusive(()=>send(pending))}>使用原请求继续提交</button></div><details><summary>查看原提交内容</summary><p>{pending.envelope.kind==='project'?pending.envelope.body.initialRequest.text:pending.envelope.kind==='message'?pending.envelope.body.text:'计划确认'}</p></details>{(pending.envelope.kind==='project'?pending.envelope.body.initialRequest.attachmentIds.length:pending.envelope.kind==='message'?pending.envelope.body.attachmentIds.length:0)>0&&<CloseRemovedOriginal key={'removed:'+pending.key} busy={busy} onClose={()=>void exclusive(closeRemoved)}/>} {pending.envelope.kind!=='project'&&<CloseOriginal key={pending.key} busy={busy} onClose={()=>void exclusive(closeOriginal)}/>}</section>}
  {closed&&closedCommand?.closure?.reason==='REMOVED_ATTACHMENT'&&<section aria-label="开始新的空白输入"><p>原提交已关闭。你可以开始一份空白输入，旧内容和附件记录仍保留。</p><button disabled={!ready||busy||failed.current||!currentDraft.current} onClick={()=>void exclusive(startBlank)}>开始空白输入，保留原记录</button></section>}
  {!!history.items.length&&<section aria-label="已关闭的原提交"><h3>已关闭的原提交{historyContext.form==='message'?' · 依据版本 '+historyContext.basisRevision:''}</h3><p className="muted">这些记录仅供核对，不会自动复制或发送。</p>{history.items.map(item=>{const proof=item.closure;if(proof?.reason!=='REMOVED_ATTACHMENT')return null;return <article className="card" key={item.key}><h4>{proof.draftSnapshot.name||'原输入'}</h4><p>{proof.draftSnapshot.text||'原输入仅包含附件。'}</p><p>原附件已移除：{proof.attachment.name}</p><p className="muted">原输入时间 {clock(item.envelope.createdAt)} · 核实关闭 {clock(proof.lookupReadAt)}</p></article>;})}{history.nextCursor&&<button disabled={busy} onClick={()=>void exclusive(()=>readHistory(historyContext,true))}>读取更多已关闭记录</button>}</section>}
  {!!references.items.length&&<details><summary>其他依据的本机草稿</summary><p className="muted">这些草稿仅供参考，不会自动采用旧提交条件。</p>{references.items.map(d=><article key={d.key}><p className="muted">依据版本 {d.context.basisRevision} · {clock(d.updatedAt)}</p><p>{d.text}</p>{(d.closedKey||d.previousClosedKey)&&<button disabled={busy} onClick={()=>void exclusive(()=>readHistory(d.context))}>查看此依据的已关闭记录</button>}<button disabled={disabled||dirty.current||failed.current} onClick={()=>edit({text:d.text,name:d.name})}>以当前依据复制此正文</button></article>)}{references.nextCursor&&<button disabled={busy} onClick={()=>void exclusive(async()=>{const more=await local.current!.references(context,references.nextCursor!);setReferences({items:[...references.items,...more.items],nextCursor:more.nextCursor});})}>读取更多旧草稿</button>}</details>}
 </section>;
}

function Workbench({boot}:{boot:WorkbenchBoot}){
 const [projects,setProjects]=useState<z.output<typeof projectsPage>['projects']>([]),[projectCursor,setProjectCursor]=useState<string|null>(null),[selection,setSelection]=useState<WorkbenchSelection|null>(boot.selection),[workspace,setWorkspace]=useState<Workspace|null>(null),[inputBasis,setInputBasis]=useState<number|null>(null),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[resultNotice,setResultNotice]=useState(''),[denied,setDenied]=useState(false),[tab,setTab]=useState<(typeof tabs)[number]>('任务'),[panel,setPanel]=useState('conversation');
  const controllers=useRef(new Set<AbortController>()),generation=useRef(0),disposed=useRef(false),navigation=useRef(false),projectLoading=useRef(false),guard=useRef<()=>Promise<boolean>>(async()=>true),planGuard=useRef<()=>Promise<boolean>>(async()=>true),ui=useRef(new Map<string,{tab:(typeof tabs)[number];panel:string}>()),selected=useRef(selection),view=useRef(workspace);
  const guarded=async()=>await guard.current()&&await planGuard.current();
 selected.current=selection;view.current=workspace;
  function closeProtected(message:string,keep?:AbortController){generation.current++;for(const c of controllers.current)if(c!==keep)c.abort();setDenied(true);setWorkspace(null);setProjects([]);setLoading(false);setResultNotice('');setNotice(message);}
 async function request(path:string,init:RequestInit={},token=generation.current){
  const controller=new AbortController();controllers.current.add(controller);
  try{
   const headers=new Headers(init.headers);headers.set('x-devmesh-principal',boot.principalId);
   const r=await fetch(path,{...init,headers,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
    if(!r.ok){if([401,403].includes(r.status)&&token===generation.current&&!disposed.current)closeProtected('登录身份或项目权限已变化，请重新进入工作台。',controller);let code='REQUEST_FAILED';try{const v=await r.json() as {error?:{code?:unknown}};if(typeof v.error?.code==='string')code=v.error.code;}catch{/* Error bodies carry no business facts. */}throw new ApiError(r.status,code);}
    if((init.method??'GET').toUpperCase()==='GET'&&r.status!==200)throw Error('Unexpected protected read status');
    if(!r.headers.get('content-type')?.includes('application/json'))throw Error('Invalid response');const value=await r.json() as unknown;if(token!==generation.current||disposed.current)throw new DOMException('Obsolete workspace request','AbortError');return value;
  }finally{controllers.current.delete(controller);}
 }
  async function listProjects(cursor?:string){if(projectLoading.current||disposed.current)return;projectLoading.current=true;const token=generation.current;try{const p=projectsPage.parse(await request('/api/v1/projects?limit=20'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{},token));if(token===generation.current&&!disposed.current){setProjects(old=>cursor?[...old,...p.projects.filter(p=>!old.some(x=>x.projectId===p.projectId))]:p.projects);setProjectCursor(p.nextCursor);}}catch{if(token===generation.current&&!disposed.current)setNotice('项目列表暂时无法加载，请刷新重试。');}finally{projectLoading.current=false;}}
 async function navigate(next:WorkbenchSelection|null){
   if(navigation.current||disposed.current)return;navigation.current=true;let token:number|undefined,admitting=true;
  try{
    if(!await guarded()){setNotice('当前输入尚未保存或提交正在核实，请先在输入区处理后切换。');return;}
   const oldKey=view.current?.run.runId??'new';ui.current.set(oldKey,{tab,panel});if(view.current)ui.current.set(view.current.project.projectId,{tab,panel});
    token=++generation.current;for(const c of controllers.current)c.abort();setLoading(true);setWorkspace(null);setSelection(next);setNotice('');setResultNotice('');const state=ui.current.get(next?.runId??next?.projectId??'new');setTab(state?.tab??'任务');setPanel(state?.panel??'conversation');navigation.current=false;admitting=false;
   if(next){const value=workspaceView.parse(await request('/api/v1/projects/'+encodeURIComponent(next.projectId)+'/workspace?limit=50'+(next.runId?'&runId='+encodeURIComponent(next.runId):''),{},token));if(token!==generation.current||disposed.current)return;if(value.project.projectId!==next.projectId||(next.runId&&value.run.runId!==next.runId))throw Error('Wrong workspace');setWorkspace(value);setInputBasis(value.run.resourceRevision);setSelection({projectId:value.project.projectId,runId:value.run.runId});}
   if(token===generation.current&&!disposed.current){const url=new URL(location.href);url.search='';if(next){url.searchParams.set('projectId',next.projectId);if(next.runId)url.searchParams.set('runId',next.runId);}history.replaceState(null,'',url);}
   }catch(e){if(token===generation.current&&!disposed.current){if(e instanceof ApiError&&e.status===404)closeProtected('当前执行不存在或已不可见，请重新进入工作台。');else setNotice(old=>old||'当前执行暂时无法加载，请核对访问权限后刷新。');}}finally{if(admitting)navigation.current=false;if(token===generation.current&&!disposed.current)setLoading(false);}
 }
 async function confirmed(next:WorkbenchSelection){await listProjects();await navigate(next);}
  async function refresh(){if(navigation.current)return;if(!await guarded()){setNotice('当前草稿尚未保存，请先处理输入区。');return;}if(!view.current){await navigate(selected.current);return;}const old=view.current,token=generation.current;navigation.current=true;setLoading(true);try{const after=old.messages.at(-1)?.messageId,value=workspaceView.parse(await request('/api/v1/projects/'+encodeURIComponent(old.project.projectId)+'/workspace?runId='+encodeURIComponent(old.run.runId)+'&limit=50'+(after?'&afterMessageId='+encodeURIComponent(after):''),{},token));if(token!==generation.current||disposed.current)return;if(value.project.projectId!==old.project.projectId||value.run.runId!==old.run.runId)throw Error('Wrong workspace');setWorkspace({...value,messages:[...old.messages,...value.messages.filter(m=>!old.messages.some(x=>x.messageId===m.messageId))]});setNotice('当前执行已刷新。');}catch(e){if(token===generation.current&&!disposed.current){if(e instanceof ApiError&&e.status===404)closeProtected('当前执行不存在或已不可见，请重新进入工作台。');else setNotice('暂时无法刷新当前执行。');}}finally{navigation.current=false;if(token===generation.current&&!disposed.current)setLoading(false);}}
 useEffect(()=>{disposed.current=false;void(async()=>{await navigate(boot.selection);await listProjects();})();const hide=()=>{disposed.current=true;for(const c of controllers.current)c.abort();},show=(e:PageTransitionEvent)=>{if(e.persisted)location.reload();};window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);return()=>{hide();window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);};},[]);
  const context:Extract<DraftContext,{form:'project'|'message'}>=workspace?{principalId:boot.principalId,form:'message',projectId:workspace.project.projectId,runId:workspace.run.runId,basisRevision:inputBasis??workspace.run.resourceRevision}:{principalId:boot.principalId,form:'project',projectId:null,runId:null,basisRevision:null};
 // Read-only contexts receive no command composer or local command client.
 const canCompose=!denied&&(!selection?!loading:workspace?.mode==='current'&&workspace.allowedActions.includes('saveMessage'));
 async function selectTab(name:(typeof tabs)[number]){if(!await guarded()){setNotice('当前回答或输入尚未保存，请先处理当前表单。');return false;}setTab(name);return true;}
 const currentToken=generation.current,api:Api=(path,init)=>request(path,init,currentToken);
  async function changed(result?:string){if(currentToken!==generation.current||disposed.current)return;setResultNotice(result??'');await refresh();}
 return <><header className="bar"><span className="brand">DEV MESH</span><span className="muted">{workspace?workspace.project.name+' · '+(workspace.mode==='history'?'历史只读':'当前执行'):'从需求开始，逐步交付。'}</span><div className="actions"><button disabled={loading||denied} onClick={()=>void refresh()}>刷新当前执行</button>{denied&&<a href="/api/v1/workbench/view">重新进入工作台</a>}</div><nav className="mobile-nav" aria-label="工作台区域">{[['sidebar','项目'],['conversation','输入'],['detail','详情']].map(([key,label])=><button key={key} aria-pressed={panel===key} onClick={()=>setPanel(key!)}>{label}</button>)}</nav>{resultNotice&&!denied&&<p className="notice result-notice" role="status">{resultNotice}</p>}</header>
  <div className="layout"><aside data-panel="sidebar" className={'sidebar '+(panel==='sidebar'?'visible':'')} aria-label="项目导航"><h2>我的项目</h2><button className="primary" disabled={denied} onClick={()=>void navigate(null)}>新建项目</button><div className="project-list">{projects.map(p=><button key={p.projectId} className={selection?.projectId===p.projectId?'selected':''} disabled={denied} onClick={()=>void navigate({projectId:p.projectId})}>{p.name}</button>)}</div>{!projects.length&&!denied&&<p className="muted">尚未加载到可见项目。</p>}{projectCursor&&<button disabled={denied} onClick={()=>void listProjects(projectCursor)}>更多项目</button>}</aside>
   <main data-panel="conversation" className={'conversation '+(panel==='conversation'?'visible':'')}><h1>{workspace?.project.name??'开始一个新项目'}</h1>{notice&&<p className="notice" role="status">{notice}</p>}{loading&&<p role="status">正在读取当前执行…</p>}
    {!denied&&workspace&&<><section aria-label="已提交输入">{workspace.messages.map(m=><article className="message" key={m.messageId}><span className="muted">已提交 · {clock(m.createdAt)}</span><p>{m.text}</p>{!!m.attachmentIds.length&&<p className="muted">附件 {m.attachmentIds.length} 项</p>}</article>)}</section>{workspace.nextMessageCursor&&<button disabled={loading} onClick={()=>void refresh()}>加载后续已保存输入</button>}{workspace.mode==='history'&&<p className="notice">这是历史执行，只读查看。<button onClick={()=>void navigate({projectId:workspace.project.projectId})}>进入当前执行</button></p>}{workspace.mode==='current'&&!workspace.allowedActions.includes('saveMessage')&&<p className="notice">当前权限或执行状态不允许提交输入。</p>}</>}
    {canCompose&&workspace&&inputBasis!==workspace.run.resourceRevision&&<p className="notice">当前执行依据已变化，原草稿和提交条件仍保留。<button disabled={loading} onClick={()=>void(async()=>{if(await guarded())setInputBasis(workspace.run.resourceRevision);else setNotice('请先保存当前草稿，再切换依据。');})()}>切换到当前依据，保留旧草稿</button></p>}
    {canCompose&&<Composer key={draftKey(context)} context={context} api={api} guard={guard} onConfirmed={confirmed}/>}
    {!canCompose&&!denied&&workspace?.mode==='current'&&workspace.membership!=='viewer'&&<WorkbenchRecovery key={JSON.stringify([boot.principalId,workspace.run.runId,workspace.run.resourceRevision,'message'])} principalId={boot.principalId} workspace={workspace} form="message" read={path=>api(path)} write={(path,init)=>api(path,init)} guard={guard} onChanged={changed}/>}
   </main>
   <aside data-panel="detail" className={'detail '+(panel==='detail'?'visible':'')} aria-label="执行详情"><div role="tablist" aria-label="执行信息" className="tabs">{tabs.map((name,index)=><button key={name} id={'tab-'+index} role="tab" aria-selected={tab===name} aria-controls="detail-panel" tabIndex={tab===name?0:-1} onClick={()=>void selectTab(name)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;void selectTab(tabs[next]!).then(changed=>{if(changed)document.getElementById('tab-'+next)?.focus();});}}}>{name}</button>)}</div><section id="detail-panel" role="tabpanel" aria-labelledby={'tab-'+tabs.indexOf(tab)}>
    {!workspace?<p className="muted">{denied?'请重新确认访问权限。':'选择项目后查看执行信息。'}</p>:tab==='任务'?<WorkbenchPlanning key={boot.principalId+':'+workspace.run.runId} principalId={boot.principalId} workspace={workspace} read={path=>api(path)} write={workspace.mode==='current'&&workspace.membership!=='viewer'?(path,init)=>api(path,init):null} guard={planGuard} before={()=>guard.current()} onChanged={changed}/>:tab==='协作'?<><h2>项目协作</h2><p>当前角色：{workspace.membership==='owner'?'项目负责人':workspace.membership==='operator'?'项目操作者':'只读成员'}</p><p className="muted">项目成员权限决定可查看与可提交的内容。</p></>:tab==='成果'?<><h2>交付状态</h2><p>{workspace.project.acceptedReleaseId?'项目已有已接受版本。':'项目尚无已接受版本。'}</p><p className="muted">交付成果须经过候选审查和明确接受。</p></>:tab==='预览'?<><h2>预览</h2><p className="muted">当前未打开预览。</p></>:<><h2>已保存记录</h2><p>当前已读取 {workspace.messages.length} 条输入。</p><p className="muted">刷新可查看最新保存的输入。</p></>}
   </section></aside>
  </div></>;
}
const root=document.getElementById('root')!;
try{createRoot(root).render(<Workbench boot={workbenchBoot.parse(JSON.parse(document.getElementById('workbench-data')?.textContent??''))}/>);}catch{root.textContent='工作台无法加载，请重新进入。';}
