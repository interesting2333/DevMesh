import {WorkbenchIcon as Icon} from './workbench-icons.js';
import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {MutableRefObject} from 'react';
import {z} from 'zod';
import {workspaceView,ids,opaqueKey,inputOperation,operationReceipt,createProjectInput,createTaskInput,saveMessageInput} from '@devmesh/contracts';
import {workbenchBoot} from './workbench-context.js';
import type {WorkbenchBoot,WorkbenchSelection} from './workbench-context.js';
import {openWorkbenchLocal} from './workbench-local.js';
import {CloseOriginal,verifyStaleOriginal,CloseRemovedOriginal,verifyRemovedOriginal,verifyStaleTaskOriginal} from './workbench-original.js';
import type {DraftContext,LocalCommand,LocalDraft} from './workbench-local.js';
import {WorkbenchApiError as ApiError} from './workbench-api.js';
import {WorkbenchPlanning} from './workbench-planning.js';
import {WorkbenchRecovery} from './workbench-recovery.js';
import {WorkbenchTaskEntry} from './workbench-task-entry.js';
import {WorkbenchDelivery} from './workbench-delivery.js';
import type {DeliveryReading} from './workbench-delivery.js';
import {readWorkbenchReading,saveWorkbenchReading,saveWorkbenchReturn} from './workbench-reading.js';
import type {WorkbenchReading} from './workbench-reading.js';
import {AttachmentControls,sendUploadOriginal,lookupUploadOriginal,verifySelectedUpload} from './workbench-attachments.js';
import type {LocalUpload} from './workbench-upload.js';
import {observeWorkbenchEvents} from './workbench-live.js';
import type {WorkbenchLiveState} from './workbench-live.js';
type ControlStatus={controlGate:string;unresolved:number;lastCheckedAt:string|null;overdue:boolean;controlRevision:number;recoveryReviewHash:string|null};
type ModelSettings={configured:boolean;providerId:string|null;endpoint:string|null;model:string|null;hasApiKey:boolean;updatedAt:string|null};
import {WorkbenchModelProgress} from './workbench-progress.js';

type Workspace=z.output<typeof workspaceView>;
type Store=Awaited<ReturnType<typeof openWorkbenchLocal>>;
type Api=(path:string,init?:RequestInit)=>Promise<unknown>;
const projectsPage=z.strictObject({projects:z.array(z.strictObject({projectId:ids.project,name:z.string(),updatedAt:z.string(),membership:opaqueKey})).max(100),nextCursor:z.string().nullable()});
const tabs=['任务','协作','成果','预览','记录'] as const;
const clock=(value:string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const draftKey=(c:DraftContext)=>JSON.stringify(c);

function Composer({context,api,guard,onConfirmed,canSubmit=true}:{context:Extract<DraftContext,{form:'project'|'message'|'task'}>;api:Api;guard:MutableRefObject<()=>Promise<boolean>>;onConfirmed:(selection:WorkbenchSelection)=>Promise<void>;canSubmit?:boolean}){
 const [fields,setFields]=useState<{text:string;name:string;task?:{kind:'ITERATION'|'FIX'|null;title:string}}>({text:'',name:'',...(context.form==='task'?{task:{kind:null,title:''}}:{})}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('正在读取本机草稿…'),[problem,setProblem]=useState(''),[pending,setPending]=useState<LocalCommand|null>(null),[references,setReferences]=useState<{items:LocalDraft[];nextCursor:string|null}>({items:[],nextCursor:null}),[discard,setDiscard]=useState(false),[closed,setClosed]=useState(false),[closedCommand,setClosedCommand]=useState<LocalCommand|null>(null),[history,setHistory]=useState<Awaited<ReturnType<Store['closedHistory']>>>({items:[],nextCursor:null}),[historyContext,setHistoryContext]=useState<DraftContext>(context);
 const [uploads,setUploads]=useState<LocalUpload[]>([]),[library,setLibrary]=useState<LocalUpload[]|null>(null),[memory,setMemory]=useState<File|null>(null),[fileProblem,setFileProblem]=useState(''),[fileStatus,setFileStatus]=useState('');
 const memoryFile=useRef<File|null>(null),libraryOpen=useRef(false);
 const currentDraft=useRef<LocalDraft|null>(null),local=useRef<Store|null>(null),latest=useRef(fields),revision=useRef(0),dirty=useRef(false),serial=useRef(0),failed=useRef(false),pumping=useRef(false),queue=useRef(Promise.resolve()),working=useRef(false),original=useRef<LocalCommand|null>(null),disposed=useRef(false),composition=useRef(false);
 function localFailure(e:unknown){failed.current=true;if(disposed.current)return;setProblem(e&&typeof e==='object'&&'code'in e&&e.code==='LOCAL_CONFLICT'?'另一页已修改这份草稿。本页修改仍保留，请读取并核对后再选择。':'本页输入尚未保存。请重试；离开前需成功保存或明确放弃未保存的修改。');setStatus('尚未保存在本机');}
 function hydrate(value:Awaited<ReturnType<Store['load']>>){
  currentDraft.current=value.draft;setClosedCommand(null);const f={text:value.draft?.text??'',name:value.draft?.name??'',...(context.form==='task'?{task:value.draft?.task??{kind:null,title:''}}:{})};latest.current=f;revision.current=value.draft?.revision??0;dirty.current=false;failed.current=false;original.current=value.pending;setFields(f);setPending(value.pending);setClosed(!!value.draft?.closedKey);setProblem('');setDiscard(false);setStatus(value.pending?'原提交结果待核实':value.draft?.closedKey?'此依据的原提交已关闭，旧草稿保留。请切换当前依据。':value.draft?'草稿已保存在本机':'尚未填写');
 }
 async function refreshUploads(){
  if(!local.current)return;
  const selected=await local.current.loadUploads(original.current?.envelope.context??context);
  const all=libraryOpen.current?await local.current.listUploads():null;
  if(!disposed.current){setUploads(selected);setLibrary(all);}
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
   if(context.form==='message'||context.form==='task'){const refs=await store.references(context);if(!disposed.current)setReferences(refs);}
   const savedHistory=await store.closedHistory(context),savedClosed=value.draft?.closedKey?await store.getCommand(value.draft.closedKey):null;if(!disposed.current){setHistory(savedHistory);setHistoryContext(context);setClosedCommand(savedClosed);}
   await refreshUploads();
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
  disposed.current=false;guard.current=async()=>{if(working.current)return false;return await flush()&&memoryFile.current===null;};
  const before=(e:BeforeUnloadEvent)=>{if(dirty.current||memoryFile.current){e.preventDefault();e.returnValue='';}};
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
 function attachmentAction(work:()=>Promise<void>){void exclusive(async()=>{
  setFileProblem('');setFileStatus('');
  try{await work();await refreshUploads();}
  catch(e){
   try{await refreshUploads();}catch{/* Keep the last readable selection and the exact local journal. */}
   if(disposed.current)return;
   const code=e&&typeof e==='object'&&'code'in e?e.code:null;
   if(code==='LOCAL_CONFLICT')localFailure(e);
   setFileProblem(code==='INVALID_UPLOAD'?'此文件尚未保存。请使用有效的 UTF-8 文本 .txt、.md 或 .markdown，大小为 1 字节至 2 MiB；本页文件仍保留。':code==='UPLOAD_LIMIT'?'本机附件数量已达上限。本次最多选择 3 个；可从本次输入移除附件，或在本机上传记录中明确释放已知结果的原文件。':memoryFile.current?'文件尚未保存，仍在本页。请重试保存或核对本机草稿；离开前需保存成功或明确放弃。':'暂时无法核实附件。原文件和上传记录仍保留；可核实原上传或使用同一原文件重试。');
  }
 });}
 async function persistMemory(){
  const file=memoryFile.current;if(!file||!local.current||!await flush())return;
  if(revision.current===0){const d=await local.current.save(context,0,{...latest.current});revision.current=d.revision;currentDraft.current=d;}
  const result=await local.current.addUpload(context,revision.current,file);revision.current=result.draft.revision;currentDraft.current=result.draft;
  memoryFile.current=null;if(!disposed.current){setMemory(null);setFileStatus('文件已保存在本机，尚需你明确上传或核实。');}
 }
 function chooseFile(file:File){
  if(working.current||memoryFile.current||disposed.current)return;
  memoryFile.current=file;setMemory(file);attachmentAction(persistMemory);
 }
 function unlinkFile(key:string){attachmentAction(async()=>{
  if(!local.current||memoryFile.current||!await flush())return;
  const d=await local.current.unlinkUpload(context,revision.current,key);revision.current=d.revision;currentDraft.current=d;setFileStatus('已从本次输入移除，原上传记录仍保留。');
 });}
 function copyFile(key:string){attachmentAction(async()=>{
  if(!local.current||memoryFile.current)return;const v=await local.current.getUpload(key);
  if(!v||v.bytes===null||v.receipt?.status!=='SUCCEEDED'&&v.receipt?.status!=='FAILED')throw Error('Unknown upload cannot be copied');
  const file=new File([new Uint8Array(v.bytes)],v.envelope.metadata.name,{type:v.envelope.mime});memoryFile.current=file;setMemory(file);await persistMemory();
 });}
 async function accept(command:LocalCommand,value:unknown){
  const parsed=z.union([inputOperation,operationReceipt]).parse(value),observed=await local.current!.observe(command.key,parsed);
  if(disposed.current)return;
  if(observed.receipt?.status!=='SUCCEEDED'){setPending(observed);original.current=observed;setProblem('原操作仍待核实，请保留原记录。');return;}
  const result=z.object({projectId:ids.project,runId:ids.run}).parse(observed.receipt.result);hydrate(await local.current!.load(context));await refreshUploads();setStatus('输入已提交保存；后台处理结果另行更新。');
  working.current=false;await onConfirmed(result);
 }
 async function send(command:LocalCommand){
  const e=command.envelope,value=await api(e.path,{method:'POST',headers:{'content-type':'application/json','idempotency-key':e.key,...(e.ifMatch?{'if-match':e.ifMatch}:{})},body:JSON.stringify(e.body)});await accept(command,value);
 }
 async function closeOriginal(){const p=original.current!;let committed=false;try{const c=p.envelope.context,verified=c.form==='task'?await verifyStaleTaskOriginal(p,path=>api(path)):await verifyStaleOriginal(p,path=>api(path));if(verified.kind==='operation'){await accept(p,verified.value);return;}if(verified.proof.reason==='STALE_PROJECT_BASIS'){const d=(await local.current!.load(c)).draft;if(!d)throw Error('Missing original draft');await local.current!.closeStaleProject(p,d,verified.proof);}else await local.current!.closeStale(p,verified.proof);committed=true;hydrate(await local.current!.load(context));setStatus('过期原提交已核实关闭，旧草稿仍保留。');if(c.form==='task'){working.current=false;await onConfirmed({projectId:c.projectId});return;}if(c.form==='project')throw Error('Wrong closure');working.current=false;await onConfirmed({projectId:c.projectId,runId:c.runId});}catch{setProblem(committed?'关闭已保存在本机，但当前内容尚未刷新，请重新进入。':'尚不能关闭原提交。请核实当前权限、依据及原操作；原记录继续保留。');}}

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
 function submit(){if(!ready||closed||!canSubmit||original.current||failed.current||memoryFile.current)return;void exclusive(async()=>{
  if(!await flush()||!local.current)return;
  // Validate user input before creating an immutable pending original.
  const draft=(await local.current.load(context)).draft;if(!draft)throw Error('Missing draft');
  if(context.form==='task'){
   const fresh=workspaceView.parse(await api('/api/v1/projects/'+encodeURIComponent(context.projectId)+'/workspace?limit=1'));
   if(fresh.project.projectId!==context.projectId||fresh.run.projectId!==context.projectId||fresh.mode!=='current')throw Error('Wrong current project');
   if(fresh.membership==='viewer'){working.current=false;await onConfirmed({projectId:context.projectId});return;}
   if(fresh.project.revision!==context.basisRevision||fresh.project.acceptedReleaseId!==context.basis.baseAcceptedReleaseId||!fresh.allowedActions.includes('createTask')){setProblem('项目起点或任务状态已变化，本次目标尚未提交。请刷新当前执行，核对当前项目起点后再选择；原草稿和附件仍保留。');return;}
  }
  const verified:LocalUpload[]=[];
  try{
   for(const upload of await local.current.loadUploads(context)){
    if(upload.receipt?.status!=='SUCCEEDED')throw Error('Upload result is unknown');
    const fresh=await verifySelectedUpload(local.current,upload,path=>api(path));
    if(fresh.attachment?.state!=='READY')throw Error('Attachment is not ready');verified.push(fresh);
   }
   await refreshUploads();setFileProblem('');
  }catch{try{await refreshUploads();}catch{/* Unreadable native records never become an empty selection. */}if(!disposed.current)setFileProblem('所选附件尚不能提交。请逐一上传或核实；已移除或无法读取的附件仍保留在本次选择中，不会自动省略。');return;}
  const attachmentIds=verified.map(v=>v.attachment!.attachmentId);
  if(context.form==='project')createProjectInput.parse({initialRequest:{text:draft.text,attachmentIds},clientDraftId:draft.clientDraftId,...(draft.name?{name:draft.name}:{})});
  else if(context.form==='task')createTaskInput.parse({kind:draft.task?.kind,title:draft.task?.title,goal:{text:draft.text,attachmentIds},baseAcceptedReleaseId:context.basis.baseAcceptedReleaseId,clientDraftId:draft.clientDraftId});
  else saveMessageInput.parse({text:draft.text,attachmentIds,clientMessageId:draft.clientDraftId});
  const q=await local.current.enqueue(context,revision.current,verified);revision.current=q.draft.revision;original.current=q.command;setPending(q.command);setProblem('');setStatus('原请求已保存在本机，正在提交…');await send(q.command);
 });}
 async function lookup(){const p=original.current;if(!p||!local.current)return;await exclusive(async()=>{
  try{const value=await api('/api/v1/operations/lookup?scope='+encodeURIComponent(p.envelope.scope)+'&key='+encodeURIComponent(p.key));await accept(p,value);}
  catch(e){if(e instanceof ApiError&&e.status===404){setProblem('当前未查到原操作。请保留原记录；可明确使用同一原请求继续提交。');return;}throw e;}
 });}
 const disabled=!ready||busy||pending!==null||closed;
 return <section className="card composer" aria-label={context.form==='project'?'新项目输入':context.form==='task'?'新任务目标':'补充输入'}>
  <h2>{context.form==='project'?'从一个需求开始':context.form==='task'?'新增或修复下一目标':'补充说明或提问'}</h2>
  <form onSubmit={e=>{e.preventDefault();submit();}}>
   {context.form==='project'&&<><label htmlFor="project-name">项目名称（可选）</label><input id="project-name" placeholder="例如：团队任务协作平台" maxLength={80} value={fields.name} disabled={disabled} onChange={e=>edit({name:e.target.value})}/></>}
   {context.form==='task'&&<><label htmlFor="task-kind">目标类型</label><select id="task-kind" value={fields.task?.kind??''} disabled={disabled} onChange={e=>edit({task:{kind:e.target.value===''?null:e.target.value as 'ITERATION'|'FIX',title:latest.current.task?.title??''}})}><option value="">请选择新增或修复</option><option value="ITERATION">新增功能</option><option value="FIX">修复问题</option></select><label htmlFor="task-title">任务标题</label><input id="task-title" value={fields.task?.title??''} maxLength={240} disabled={disabled} onChange={e=>edit({task:{kind:latest.current.task?.kind??null,title:e.target.value}})}/><button type="button" disabled={disabled||!fields.text.trim()&&!uploads.length} onClick={()=>edit({task:{kind:latest.current.task?.kind??null,title:Array.from(latest.current.text.trim().replace(/\s+/g,' ')||uploads[0]?.envelope.metadata.name||'').slice(0,120).join('')}})}>根据本次目标填入标题</button><p className="muted">标题可编辑，最多120字。修复目标请说明复现条件、期望和实际结果。</p></>}
   <label htmlFor="input-text">{context.form==='project'?'描述你想完成的事':context.form==='task'?'本次目标':'输入正文'}</label><textarea id="input-text" placeholder={context.form==='project'?'描述你的目标、使用场景和期望结果…':context.form==='task'?'写下下一步想完成的目标…':'补充需求、说明细节，或提出你的问题…'} value={fields.text} maxLength={40000} disabled={disabled} onChange={e=>edit({text:e.target.value})} onCompositionStart={()=>{composition.current=true;}} onCompositionEnd={()=>{composition.current=false;}} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.repeat&&!e.nativeEvent.isComposing&&!composition.current){e.preventDefault();submit();}}}/>
   <p className="status" role="status">{status}</p>{problem&&<p role="alert" className="notice">{problem}</p>}
   <AttachmentControls selected={uploads} library={library} memory={memory} busy={busy||!ready} editable={!disabled&&!failed.current} problem={fileProblem} status={fileStatus} onChoose={chooseFile} onRetryMemory={()=>attachmentAction(persistMemory)} onDiscardMemory={()=>{memoryFile.current=null;setMemory(null);setFileProblem('');setFileStatus('已明确放弃尚未保存的文件。');}} onSend={key=>attachmentAction(async()=>{if(local.current)await sendUploadOriginal(local.current,key,(path,init)=>api(path,init),path=>api(path));})} onLookup={key=>attachmentAction(async()=>{if(local.current)await lookupUploadOriginal(local.current,key,path=>api(path));})} onUnlink={unlinkFile} onLibrary={()=>attachmentAction(async()=>{libraryOpen.current=true;})} onRelease={key=>attachmentAction(async()=>{const v=await local.current?.getUpload(key);if(!v||!local.current)throw Error('Missing original');await local.current.releaseUpload(key,v.revision);setFileStatus('已释放本机原文件，原上传记录仍保留。');})} onCopy={copyFile}/>
   <div className="actions"><button className="primary" type="submit" disabled={disabled||!canSubmit||context.form==='task'&&(!fields.task?.kind||!fields.task.title.trim())||failed.current||memory!==null||uploads.some(v=>v.receipt?.status!=='SUCCEEDED'||v.attachment?.state!=='READY')||(!fields.text.trim()&&(context.form==='message'||uploads.length===0))}>{context.form==='project'?'创建项目并保存需求':context.form==='task'?'提交本次目标':'提交输入'}</button><span className="muted">Enter 换行 · Ctrl / Cmd + Enter 提交</span></div>
  </form>
  {problem&&!pending&&<div className="actions"><button disabled={busy} onClick={()=>void exclusive(async()=>{try{await initialize(true);}catch(e){localFailure(e);}})}>重试本机保存</button><label><input type="checkbox" checked={discard} onChange={e=>setDiscard(e.target.checked)}/>我确认放弃本页未保存的修改和文件</label><button disabled={busy||!discard} onClick={()=>void exclusive(async()=>{const wasDirty=dirty.current;try{dirty.current=false;await initialize();memoryFile.current=null;setMemory(null);setFileProblem('');}catch(e){dirty.current=wasDirty;localFailure(e);}})}>放弃本页修改并重新读取</button></div>}
   {pending&&<section className="notice" aria-label="待核实原提交"><h3>原提交结果待核实</h3><p>刷新或重新进入不会自动发送。核实会查询同一原操作，继续提交会使用原正文与原条件。</p><div className="actions"><button disabled={busy} onClick={()=>void lookup()}>核实原提交</button><button disabled={busy} onClick={()=>void exclusive(()=>send(pending))}>使用原请求继续提交</button></div><details><summary>查看原提交内容</summary><p>{pending.envelope.kind==='project'?pending.envelope.body.initialRequest.text:pending.envelope.kind==='message'?pending.envelope.body.text:pending.envelope.kind==='task'?pending.envelope.body.goal.text:'计划确认'}</p></details>{(pending.envelope.kind==='project'?pending.envelope.body.initialRequest.attachmentIds.length:pending.envelope.kind==='message'?pending.envelope.body.attachmentIds.length:pending.envelope.kind==='task'?pending.envelope.body.goal.attachmentIds.length:0)>0&&<CloseRemovedOriginal key={'removed:'+pending.key} busy={busy} onClose={()=>void exclusive(closeRemoved)}/>} {pending.envelope.kind!=='project'&&<CloseOriginal key={pending.key} busy={busy} onClose={()=>void exclusive(closeOriginal)}/>}</section>}
  {closed&&closedCommand?.closure?.reason==='REMOVED_ATTACHMENT'&&<section aria-label="开始新的空白输入"><p>原提交已关闭。你可以开始一份空白输入，旧内容和附件记录仍保留。</p><button disabled={!ready||busy||failed.current||!currentDraft.current} onClick={()=>void exclusive(startBlank)}>开始空白输入，保留原记录</button></section>}
  {!!history.items.length&&<section aria-label="已关闭的原提交"><h3>已关闭的原提交{historyContext.form==='message'?' · 依据版本 '+historyContext.basisRevision:''}</h3><p className="muted">这些记录仅供核对，不会自动复制或发送。</p>{history.items.map(item=>{const proof=item.closure;if(proof?.reason!=='REMOVED_ATTACHMENT'&&proof?.reason!=='STALE_PROJECT_BASIS')return null;return <article className="card" key={item.key}><h4>{proof.draftSnapshot.task?.title||proof.draftSnapshot.name||'原输入'}</h4><p>{proof.draftSnapshot.text||'原输入仅包含附件。'}</p>{proof.reason==='REMOVED_ATTACHMENT'?<p>原附件已移除：{proof.attachment.name}</p>:<p>原任务项目起点已过期，原目标保留。</p>}<p className="muted">原输入时间 {clock(item.envelope.createdAt)} · 核实关闭 {clock(proof.lookupReadAt)}</p></article>;})}{history.nextCursor&&<button disabled={busy} onClick={()=>void exclusive(()=>readHistory(historyContext,true))}>读取更多已关闭记录</button>}</section>}
  {!!references.items.length&&<details><summary>其他依据的本机草稿</summary><p className="muted">这些草稿仅供参考，不会自动采用旧提交条件。</p>{references.items.map(d=><article key={d.key}><p className="muted">依据版本 {d.context.basisRevision} · {clock(d.updatedAt)}</p><p>{d.text}</p>{(d.closedKey||d.previousClosedKey)&&<button disabled={busy} onClick={()=>void exclusive(()=>readHistory(d.context))}>查看此依据的已关闭记录</button>}<button disabled={disabled||dirty.current||failed.current} onClick={()=>edit({text:d.text,name:d.name,...(context.form==='task'&&d.task?{task:{...d.task}}:{})})}>{context.form==='task'?'以当前依据复制此目标':'以当前依据复制此正文'}</button></article>)}{references.nextCursor&&<button disabled={busy} onClick={()=>void exclusive(async()=>{const more=await local.current!.references(context,references.nextCursor!);setReferences({items:[...references.items,...more.items],nextCursor:more.nextCursor});})}>读取更多旧草稿</button>}</details>}
 </section>;
}

function Workbench({boot}:{boot:WorkbenchBoot}){
 const [projects,setProjects]=useState<z.output<typeof projectsPage>['projects']>([]),[projectCursor,setProjectCursor]=useState<string|null>(null),[selection,setSelection]=useState<WorkbenchSelection|null>(boot.selection),[workspace,setWorkspace]=useState<Workspace|null>(null),[inputBasis,setInputBasis]=useState<number|null>(null),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[resultNotice,setResultNotice]=useState(''),[denied,setDenied]=useState(false),[tab,setTab]=useState<(typeof tabs)[number]>('任务'),[panel,setPanel]=useState<WorkbenchReading['panel']>('conversation'),[deliveryReading,setDeliveryReading]=useState<DeliveryReading>({candidateId:null,candidateAfterRevision:0});
   const controllers=useRef(new Set<AbortController>()),generation=useRef(0),disposed=useRef(false),navigation=useRef(false),projectLoading=useRef(false),guard=useRef<()=>Promise<boolean>>(async()=>true),planGuard=useRef<()=>Promise<boolean>>(async()=>true),ui=useRef(new Map<string,{tab:(typeof tabs)[number];panel:WorkbenchReading['panel']}&DeliveryReading>()),selected=useRef(selection),view=useRef(workspace);
  const observer=useRef<ReturnType<typeof observeWorkbenchEvents>|null>(null),[live,setLive]=useState<(WorkbenchLiveState&{runId:string})|null>(null),[control,setControl]=useState<ControlStatus|null>(null),[collaboration,setCollaboration]=useState<{changes:{changeId:string;state:string;proposedText:string}[];configs:{adjustmentId:string;state:string}[];generation:number}|null>(null);
  const [moreOpen,setMoreOpen]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[modelSettings,setModelSettings]=useState<ModelSettings|null>(null),[settingsForm,setSettingsForm]=useState({providerId:'deepseek',endpoint:'https://api.deepseek.com',model:'deepseek-chat',apiKey:''}),[settingsBusy,setSettingsBusy]=useState(false),[settingsMessage,setSettingsMessage]=useState('');
  const guarded=async()=>await guard.current()&&await planGuard.current();
 const readingPosition=useRef({tab,panel,...deliveryReading});readingPosition.current={tab,panel,...deliveryReading};
 selected.current=selection;view.current=workspace;
   function closeProtected(message:string,keep?:AbortController){generation.current++;observer.current?.stop();for(const c of controllers.current)if(c!==keep)c.abort();setDenied(true);setWorkspace(null);setProjects([]);setLoading(false);setResultNotice('');setNotice(message);}
 async function request(path:string,init:RequestInit={},token=generation.current){
  const controller=new AbortController();controllers.current.add(controller);
  try{
   const headers=new Headers(init.headers);headers.set('x-devmesh-principal',boot.principalId);
    const r=await fetch(path,{...init,headers,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000),...(init.signal?[init.signal]:[])])});
    if(!r.ok){if([401,403].includes(r.status)&&token===generation.current&&!disposed.current)closeProtected('登录身份或项目权限已变化，请重新进入工作台。',controller);let code='REQUEST_FAILED';try{const v=await r.json() as {error?:{code?:unknown}};if(typeof v.error?.code==='string')code=v.error.code;}catch{/* Error bodies carry no business facts. */}throw new ApiError(r.status,code);}
    if((init.method??'GET').toUpperCase()==='GET'&&r.status!==200)throw Error('Unexpected protected read status');
    if((init.method??'GET').toUpperCase()==='POST'&&path==='/api/v1/attachments'&&r.status!==201)throw Error('Unexpected upload response status');
    if(!r.headers.get('content-type')?.includes('application/json'))throw Error('Invalid response');const value=await r.json() as unknown;if(token!==generation.current||disposed.current)throw new DOMException('Obsolete workspace request','AbortError');return value;
  }finally{controllers.current.delete(controller);}
 }
  async function loadControl(runId:string,token=generation.current){
    try{
      const value=await request('/api/v1/runs/'+encodeURIComponent(runId)+'/control',{},token) as {controlGate?:unknown;unresolved?:unknown;lastCheckedAt?:unknown;verificationOverdue?:unknown;controlRevision?:unknown;recoveryReviewHash?:unknown};
      if(token!==generation.current||disposed.current)return;
      setControl({controlGate:String(value.controlGate),unresolved:Array.isArray(value.unresolved)?value.unresolved.length:0,lastCheckedAt:typeof value.lastCheckedAt==='string'?value.lastCheckedAt:null,overdue:value.verificationOverdue===true,controlRevision:typeof value.controlRevision==='number'?value.controlRevision:1,recoveryReviewHash:typeof value.recoveryReviewHash==='string'?value.recoveryReviewHash:null});
    }catch{/* Control status is auxiliary; the workspace read stays authoritative. */}
  }
  async function loadCollaboration(runId:string,token=generation.current){
    try{
      const [changes,configs,generationInfo]=await Promise.all([
        request('/api/v1/runs/'+encodeURIComponent(runId)+'/changes',{},token) as Promise<{changes?:{changeId:string;state:string;proposedText:string}[]}>,
        request('/api/v1/runs/'+encodeURIComponent(runId)+'/config-adjustments',{},token) as Promise<{adjustments?:{adjustmentId:string;state:string}[]}>,
        request('/api/v1/config/generation?runId='+encodeURIComponent(runId),{},token) as Promise<{generation?:number}>
      ]);
      if(token!==generation.current||disposed.current)return;
      setCollaboration({changes:changes.changes??[],configs:configs.adjustments??[],generation:generationInfo.generation??0});
    }catch{setCollaboration(null);}
  }
  async function openSettings(){
    setMoreOpen(false);setSettingsOpen(true);setSettingsMessage('');setSettingsBusy(true);
    try{const value=await request('/api/v1/settings/model',{},generation.current) as ModelSettings;setModelSettings(value);setSettingsForm({providerId:value.providerId??'deepseek',endpoint:value.endpoint??'https://api.deepseek.com',model:value.model??'deepseek-chat',apiKey:''});}
    catch{setSettingsMessage('设置暂时无法加载，请稍后重试。');}
    finally{setSettingsBusy(false);}
  }
  async function saveModelSettings(){
    setSettingsBusy(true);setSettingsMessage('');
    try{
      const endpoint=settingsForm.endpoint.trim(),normalized=/^https?:\/\//i.test(endpoint)?endpoint:`https://${endpoint}`;
      const body={providerId:settingsForm.providerId,endpoint:normalized,model:settingsForm.model,...(settingsForm.apiKey.trim()?{apiKey:settingsForm.apiKey.trim()}:{})};
      const value=await request('/api/v1/settings/model',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)},generation.current) as ModelSettings;
      setModelSettings(value);setSettingsForm(form=>({...form,apiKey:''}));setSettingsMessage('已保存。重启服务后生效。');
    }catch(error){
      const detail=error instanceof ApiError?({MODEL_ENDPOINT_INVALID:'Endpoint 需要是完整地址，例如 https://api.deepseek.com（本机可用 http://127.0.0.1）',MODEL_KEY_REQUIRED:'请填写 API Key',MODEL_KEY_INVALID:'API Key 含换行或长度不合法',MODEL_SETTINGS_INVALID:'Provider 或模型 ID 含非法字符'}[error.code]??`保存失败（${error.code}）`):'保存失败，请检查网络后重试。';
      setSettingsMessage(detail);
    }
    finally{setSettingsBusy(false);}
  }
  async function testModelSettings(){
    setSettingsBusy(true);setSettingsMessage('正在测试连接…');
    try{
      const result=await request('/api/v1/settings/model:test',{method:'POST'},generation.current) as {ok:boolean;status:number|null;message:string};
      setSettingsMessage((result.ok?'连接成功':'连接未通过')+(result.status?`（HTTP ${result.status}）`:'')+'。'+(result.ok?'':'请检查 Endpoint、模型或密钥。'));
    }catch(error){
      const detail=error instanceof ApiError?({MODEL_KEY_REQUIRED:'请先填写并保存 API Key，再测试连接',MODEL_ENDPOINT_INVALID:'Endpoint 格式不合法'}[error.code]??`测试失败（${error.code}）`):'测试失败：请先保存密钥，或检查网络。';
      setSettingsMessage(detail);
    }
    finally{setSettingsBusy(false);}
  }
  async function controlCommand(path:string,init:RequestInit){    try{await request(path,init,generation.current);const current=view.current;if(current)await loadControl(current.run.runId);return true;}
    catch{setNotice('控制请求未确认，请刷新控制状态后重试。');return false;}
  }
  async function pauseExecution(){
    const current=view.current;if(!current||!control)return;
    await controlCommand('/api/v1/runs/'+encodeURIComponent(current.run.runId)+':pause',{method:'POST',headers:{'content-type':'application/json','idempotency-key':crypto.randomUUID(),'if-match':'"r'+control.controlRevision+'"'},body:JSON.stringify({reason:'workbench pause'})});
  }
  async function resumeExecution(){
    const current=view.current;if(!current||!control)return;
    if(!control.recoveryReviewHash){setNotice('恢复审查依据尚未就绪，请刷新后重试。');return;}
    await controlCommand('/api/v1/runs/'+encodeURIComponent(current.run.runId)+':resume',{method:'POST',headers:{'content-type':'application/json','idempotency-key':crypto.randomUUID()},body:JSON.stringify({controlRevision:control.controlRevision,recoveryReviewHash:control.recoveryReviewHash})});
  }
  async function listProjects(cursor?:string){if(projectLoading.current||disposed.current)return;projectLoading.current=true;const token=generation.current;try{const p=projectsPage.parse(await request('/api/v1/projects?limit=20'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{},token));if(token===generation.current&&!disposed.current){setProjects(old=>cursor?[...old,...p.projects.filter(p=>!old.some(x=>x.projectId===p.projectId))]:p.projects);setProjectCursor(p.nextCursor);}}catch{if(token===generation.current&&!disposed.current)setNotice('项目列表暂时无法加载，请刷新重试。');}finally{projectLoading.current=false;}}
 async function navigate(next:WorkbenchSelection|null){
   if(navigation.current||disposed.current)return;navigation.current=true;let token:number|undefined,admitting=true;
  try{
    if(!await guarded()){setNotice('当前输入尚未保存或提交正在核实，请先在输入区处理后切换。');return;}
   const oldKey=view.current?.run.runId??'new';ui.current.set(oldKey,{tab,panel,...deliveryReading});
    token=++generation.current;observer.current?.stop();for(const c of controllers.current)c.abort();setLoading(true);setWorkspace(null);setSelection(next);setNotice('');setResultNotice('');setTab('任务');setPanel('conversation');setDeliveryReading({candidateId:null,candidateAfterRevision:0});navigation.current=false;admitting=false;
   if(next){const value=workspaceView.parse(await request('/api/v1/projects/'+encodeURIComponent(next.projectId)+'/workspace?limit=50'+(next.runId?'&runId='+encodeURIComponent(next.runId):''),{},token));if(token!==generation.current||disposed.current)return;if(value.project.projectId!==next.projectId||(next.runId&&value.run.runId!==next.runId))throw Error('Wrong workspace');setWorkspace(value);setControl(null);setCollaboration(null);setInputBasis(value.run.resourceRevision);void loadControl(value.run.runId,token);setSelection({projectId:value.project.projectId,runId:value.run.runId});const memory=ui.current.get(value.run.runId),saved=memory?{state:memory,unavailable:false}:readWorkbenchReading({principalId:boot.principalId,projectId:value.project.projectId,runId:value.run.runId});setTab(saved.state?.tab??'任务');setPanel(saved.state?.panel??'conversation');setDeliveryReading({candidateId:saved.state?.candidateId??null,candidateAfterRevision:saved.state?.candidateAfterRevision??0});if(saved.unavailable)setNotice('本次阅读位置未能恢复，已打开准确执行；已保存草稿和原请求仍保留。');}
   if(token===generation.current&&!disposed.current){const url=new URL(location.href);url.search='';if(next){url.searchParams.set('projectId',next.projectId);if(next.runId)url.searchParams.set('runId',next.runId);}history.replaceState(null,'',url);}
   }catch(e){if(token===generation.current&&!disposed.current){if(e instanceof ApiError&&e.status===404)closeProtected('当前执行不存在或已不可见，请重新进入工作台。');else setNotice(old=>old||'当前执行暂时无法加载，请核对访问权限后刷新。');}}finally{if(admitting)navigation.current=false;if(token===generation.current&&!disposed.current)setLoading(false);}
 }
 async function confirmed(next:WorkbenchSelection){await listProjects();await navigate(next);}
  async function refresh(){if(navigation.current)return;if(!await guarded()){setNotice('当前草稿尚未保存，请先处理输入区。');return;}if(!view.current){await navigate(selected.current);return;}const old=view.current,token=generation.current;navigation.current=true;setLoading(true);try{const after=old.messages.at(-1)?.messageId,value=workspaceView.parse(await request('/api/v1/projects/'+encodeURIComponent(old.project.projectId)+'/workspace?runId='+encodeURIComponent(old.run.runId)+'&limit=50'+(after?'&afterMessageId='+encodeURIComponent(after):''),{},token));if(token!==generation.current||disposed.current)return;if(value.project.projectId!==old.project.projectId||value.run.runId!==old.run.runId)throw Error('Wrong workspace');observer.current?.acknowledge(value.eventCursor);setWorkspace({...value,messages:[...old.messages,...value.messages.filter(m=>!old.messages.some(x=>x.messageId===m.messageId))]});setNotice('当前执行已刷新。');}catch(e){if(token===generation.current&&!disposed.current){if(e instanceof ApiError&&e.status===404)closeProtected('当前执行不存在或已不可见，请重新进入工作台。');else setNotice('暂时无法刷新当前执行。');}}finally{navigation.current=false;if(token===generation.current&&!disposed.current)setLoading(false);}}
 useEffect(()=>{disposed.current=false;void(async()=>{await navigate(boot.selection);await listProjects();})();const hide=()=>{disposed.current=true;observer.current?.stop();for(const c of controllers.current)c.abort();},show=(e:PageTransitionEvent)=>{if(e.persisted)location.reload();};window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);return()=>{hide();window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);};},[]);
  const context:Extract<DraftContext,{form:'project'|'message'}>=workspace?{principalId:boot.principalId,form:'message',projectId:workspace.project.projectId,runId:workspace.run.runId,basisRevision:inputBasis??workspace.run.resourceRevision}:{principalId:boot.principalId,form:'project',projectId:null,runId:null,basisRevision:null};
  useEffect(()=>{
   const current=view.current;if(!current||disposed.current||denied)return;const token=generation.current,runId=current.run.runId;
   const active=observeWorkbenchEvents({scope:{schemaVersion:1,principalId:boot.principalId,projectId:current.project.projectId,runId:current.run.runId,afterSeq:current.eventCursor},
    read:(path,signal)=>request(path,{signal},token),
    onState:state=>{if(!disposed.current&&token===generation.current){setLive({...state,runId});const latest=[...state.events].reverse().find(event=>event.type==='ControlProgress');if(latest)void loadControl(runId,token);}},
    // Reconnection establishes a new authoritative cursor. Reading and drafts
    // stay as the user left them until an explicit protected refresh.
    onSnapshot:()=>{const current=view.current;if(current)void loadControl(current.run.runId,token);},
    onAuthorizationLost:()=>{if(!disposed.current&&token===generation.current)closeProtected('登录身份或项目权限已变化，请重新进入工作台。');},
   });observer.current=active;
   return()=>{active.stop();if(observer.current===active)observer.current=null;};
  },[workspace?.run.runId,denied]);
  const progress=workspace&&live?.runId===workspace.run.runId?live:null;
 // Read-only contexts receive no command composer or local command client.
 const canCompose=!denied&&(!selection?!loading:workspace?.mode==='current'&&workspace.allowedActions.includes('saveMessage'));
 async function selectTab(name:(typeof tabs)[number]){if(!await guarded()){setNotice('当前回答或输入尚未保存，请先处理当前表单。');return false;}setTab(name);const current=view.current;if(name==='协作'&&current)void loadCollaboration(current.run.runId);return true;}
 const currentToken=generation.current,api:Api=(path,init)=>request(path,init,currentToken);
  async function changed(result?:string){if(currentToken!==generation.current||disposed.current)return;setResultNotice(result??'');await refresh();}
 async function leave(path:string,targetRunId:string){
  if(navigation.current||disposed.current)return false;navigation.current=true;const token=generation.current;
  try{
   if(!await guarded()){setNotice('上次打开未完成，请先在当前表单核对保存状态，再重试。');return false;}
   const current=view.current;if(!current||disposed.current||token!==generation.current)return false;
   const position=readingPosition.current;saveWorkbenchReading({schemaVersion:1,principalId:boot.principalId,projectId:current.project.projectId,runId:current.run.runId,...position,updatedAt:new Date().toISOString()});
   saveWorkbenchReturn({schemaVersion:1,principalId:boot.principalId,projectId:current.project.projectId,sourceRunId:current.run.runId,targetRunId,createdAt:new Date().toISOString()});
   location.assign(path);return true;
  }catch{if(token===generation.current&&!disposed.current)setNotice('暂时无法保存返回位置，尚未离开工作台；页面和草稿仍保留，请重试。');return false;}
  finally{navigation.current=false;}
 }
 const normalInputs=<>{canCompose&&workspace&&inputBasis!==workspace.run.resourceRevision&&<p className="notice">当前执行依据已变化，原草稿和提交条件仍保留。<button disabled={loading} onClick={()=>void(async()=>{if(await guarded())setInputBasis(workspace.run.resourceRevision);else setNotice('请先保存当前草稿，再切换依据。');})()}>切换到当前依据，保留旧草稿</button></p>}
    {canCompose&&<Composer key={draftKey(context)} context={context} api={api} guard={guard} onConfirmed={confirmed}/>}
    {!canCompose&&!denied&&workspace?.mode==='current'&&workspace.membership!=='viewer'&&<WorkbenchRecovery key={JSON.stringify([boot.principalId,workspace.run.runId,workspace.run.resourceRevision,'message'])} principalId={boot.principalId} workspace={workspace} form="message" read={path=>api(path)} write={(path,init)=>api(path,init)} guard={guard} onChanged={changed}/>}</>;
 return <><header className="bar"><div className="header-main"><span className="brand"><span className="brand-mark"><Icon name="mesh"/></span>DevMesh</span><div className="header-context"><span>{workspace?workspace.project.name:'智能协作工作台'}</span><span className="context-badge">{workspace?(workspace.mode==='history'?'历史只读':'当前执行'):'工作空间'}</span></div><div className="actions"><button disabled={loading||denied} onClick={()=>void refresh()}><Icon name="refresh"/>刷新当前执行</button>{denied&&<a href="/api/v1/workbench/view">重新进入工作台</a>}</div></div><nav className="mobile-nav" aria-label="工作台区域">{([['sidebar','项目'],['conversation','输入'],['detail','详情']] as const).map(([key,label])=><button key={key} aria-pressed={panel===key} onClick={()=>setPanel(key!)}>{label}</button>)}</nav>{resultNotice&&!denied&&<p className="notice result-notice" role="status">{resultNotice}</p>}{workspace&&!denied&&<div className="header-status"><p className="event-notice" data-state={progress?.status??'connecting'} role="status" aria-label="执行进展连接"><i className="connection-indicator" aria-hidden="true"/><span>{progress?.status==='live'?(progress.unread?'收到 '+progress.unread+' 条新进展。':'进展已连接。'):progress?.status==='offline'?'进展连接已中断。':progress?.status==='syncing'?'正在同步已保存进展…':'正在连接执行进展…'}</span><button disabled={loading||!progress?.unread&&progress?.status!=='offline'} onClick={()=>progress?.status==='offline'?observer.current?.retry():void refresh()}>{progress?.status==='offline'?'重新连接进展':'查看更新'}</button></p>{control&&<p className="event-notice" role="status" aria-label="执行控制状态"><span>{control.controlGate==='PAUSING'?'正在暂停，等待收尾…':control.controlGate==='PAUSED'?'已暂停。':control.controlGate==='CANCELLING'?'正在取消，等待收尾…':'执行已恢复。'}{control.unresolved?' 未解决目标 '+control.unresolved+' 项。':''}{control.overdue?' 已超过 30 秒，仍在核实。':''}</span>{control.controlGate==='OPEN'&&<button disabled={loading} onClick={()=>void pauseExecution()}>暂停执行</button>}{control.controlGate==='PAUSED'&&<button disabled={loading||!control.recoveryReviewHash} onClick={()=>void resumeExecution()}>恢复执行</button>}</p>}</div>}</header>

   <div className="layout"><aside data-panel="sidebar" className={'sidebar '+(panel==='sidebar'?'visible':'')} aria-label="项目导航"><div className="sidebar-heading"><Icon name="project"/><h2>项目空间</h2></div><button className="primary" disabled={denied} onClick={()=>void navigate(null)}><Icon name="plus"/>新建项目</button><p className="nav-caption">我的项目</p><div className="project-list">{projects.map(p=><button key={p.projectId} className={selection?.projectId===p.projectId?'selected':''} disabled={denied} onClick={()=>void navigate({projectId:p.projectId})}><Icon name="project"/><span className="project-name">{p.name}</span></button>)}</div>{!projects.length&&!denied&&<p className="muted">尚未加载到可见项目。</p>}{projectCursor&&<button disabled={denied} onClick={()=>void listProjects(projectCursor)}>更多项目</button>}<p className="sidebar-note">让需求、协作与交付有迹可循。</p><div className="sidebar-footer"><button aria-haspopup="menu" aria-expanded={moreOpen} onClick={()=>setMoreOpen(value=>!value)}><Icon name="more"/>更多</button>{moreOpen&&<div className="more-menu" role="menu"><button role="menuitem" onClick={()=>void openSettings()}>设置</button></div>}</div></aside>
   <main data-panel="conversation" className={'conversation '+(panel==='conversation'?'visible':'')}>{workspace?<div className="workspace-heading"><span className="eyebrow"><Icon name="chat"/>需求与对话</span><h1>{workspace.project.name}</h1><p className="workspace-subtitle">沟通目标、补充细节，在右侧查看理解与计划。</p></div>:!denied&&<div className="welcome"><div className="welcome-badge"><Icon name="mesh"/></div><span className="eyebrow">从想法到交付</span><h1>开始一个新项目</h1><p>把想完成的事写下来。DevMesh 将协助你梳理需求、制定计划，再逐步推进实施。</p></div>}{notice&&<p className="notice" role="status">{notice}</p>}{loading&&<p role="status">正在读取当前执行…</p>}
    {!denied&&workspace&&<><section aria-label="已提交输入"><div className="section-heading"><Icon name="record"/><h2>已保存的输入</h2></div>{workspace.messages.map(m=><article className="message" key={m.messageId}><span className="muted"><Icon name="chat"/>你 · 已提交 · {clock(m.createdAt)}</span><p>{m.text}</p>{!!m.attachmentIds.length&&<p className="muted">附件 {m.attachmentIds.length} 项</p>}</article>)}</section>{workspace.nextMessageCursor&&<button disabled={loading} onClick={()=>void refresh()}>加载后续已保存输入</button>}{workspace.mode==='history'&&<p className="notice">这是历史执行，只读查看。<button onClick={()=>void navigate({projectId:workspace.project.projectId})}>进入当前执行</button></p>}{workspace.mode==='current'&&!workspace.allowedActions.includes('saveMessage')&&<p className="notice">当前执行不允许补充输入。</p>}</>}
         {!denied&&workspace?.mode==='current'&&workspace.membership!=='viewer'?<WorkbenchTaskEntry key={boot.principalId+':'+workspace.project.projectId+':'+workspace.run.runId} principalId={boot.principalId} workspace={workspace} before={guarded} normal={normalInputs}>{(taskContext,canSubmit)=><Composer key={draftKey(taskContext)} context={taskContext} api={api} guard={guard} onConfirmed={confirmed} canSubmit={canSubmit}/>}</WorkbenchTaskEntry>:normalInputs}
   </main>
   <aside data-panel="detail" className={'detail '+(panel==='detail'?'visible':'')} aria-label="执行详情"><div className="detail-heading"><Icon name="task"/><h2>执行工作区</h2></div><div role="tablist" aria-label="执行信息" className="tabs">{tabs.map((name,index)=><button key={name} id={'tab-'+index} role="tab" aria-selected={tab===name} aria-controls="detail-panel" tabIndex={tab===name?0:-1} onClick={()=>void selectTab(name)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;void selectTab(tabs[next]!).then(changed=>{if(changed)document.getElementById('tab-'+next)?.focus();});}}}><Icon name={(['task','team','artifact','preview','record'] as const)[index]!}/>{name}</button>)}</div><section id="detail-panel" role="tabpanel" aria-labelledby={'tab-'+tabs.indexOf(tab)}>
    {!workspace?(denied?<p className="muted">请重新确认访问权限。</p>:<section aria-label="项目开始指南"><h2>让想法有序落地</h2><p className="muted">从需求开始，每一步都有清晰的依据。</p><ol className="workflow-guide"><li><h3>描述你的需求</h3><p>写下目标和使用场景，也可以添加需求材料。</p></li><li><h3>梳理理解与计划</h3><p>创建项目后，在任务页签查看理解、回答问题并审阅计划。</p></li><li><h3>跟进协作与成果</h3><p>查看执行进展、审查成果，体验并确认交付。</p></li></ol><p className="guide-note">创建项目只保存需求；实施须在计划明确确认后开始。</p></section>):tab==='任务'?<WorkbenchPlanning key={boot.principalId+':'+workspace.run.runId} principalId={boot.principalId} workspace={workspace} read={path=>api(path)} write={workspace.mode==='current'&&workspace.membership!=='viewer'?(path,init)=>api(path,init):null} guard={planGuard} before={()=>guard.current()} onChanged={changed}/>:tab==='协作'?<><h2>项目协作</h2><p>当前角色：{workspace.membership==='owner'?'项目负责人':workspace.membership==='operator'?'项目操作者':'只读成员'}</p><p className="muted">项目成员权限决定可查看与可提交的内容。</p>{collaboration&&<section aria-label="变更与配置"><p>配置代际 {collaboration.generation}；变更提案 {collaboration.changes.length} 条；配置调整 {collaboration.configs.length} 条。</p>{collaboration.changes.slice(0,5).map(change=><p key={change.changeId}>{change.proposedText} · {change.state}</p>)}{collaboration.configs.slice(0,5).map(config=><p key={config.adjustmentId}>配置调整 · {config.state}</p>)}</section>}</>:tab==='成果'||tab==='预览'?<WorkbenchDelivery key={boot.principalId+':'+workspace.run.runId+':'+tab} workspace={workspace} read={path=>api(path)} reading={deliveryReading} onReading={setDeliveryReading} before={guarded} onOpen={leave} focus={tab}/>:<><h2>已保存记录</h2><p>当前已读取 {workspace.messages.length} 条输入。</p><p className="muted">刷新可查看最新保存的输入。</p>{!!progress?.events.length&&<section aria-label="最近执行进展"><p className="muted">最近接收的已保存进展；完整输入按服务端内容读取。</p><ol>{progress.events.map(event=><li key={event.eventId}>{clock(event.observedAt)} · {event.type==='InputSaved'?'输入已保存':event.type==='PlanPublished'?'计划已保存':event.type==='ReleaseAccepted'?'交付已接受':'执行记录已更新'}</li>)}</ol></section>}<WorkbenchModelProgress streams={progress?.streams??[]}/></>}
   </section></aside>
  </div>{settingsOpen&&<div className="modal-backdrop" onClick={()=>setSettingsOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-label="设置" onClick={event=>event.stopPropagation()}><div className="modal-head"><h2>设置</h2><button onClick={()=>setSettingsOpen(false)} aria-label="关闭设置">关闭</button></div><h3>模型接入</h3><p className="muted">密钥只保存在本机文件，不会回显，也不会写入数据库。保存后需重启服务生效。</p><label>Provider<input value={settingsForm.providerId} onChange={event=>setSettingsForm(form=>({...form,providerId:event.target.value}))} autoComplete="off"/></label><label>Endpoint<input value={settingsForm.endpoint} onChange={event=>setSettingsForm(form=>({...form,endpoint:event.target.value}))} autoComplete="off" inputMode="url"/></label><label>模型 ID<input value={settingsForm.model} onChange={event=>setSettingsForm(form=>({...form,model:event.target.value}))} autoComplete="off"/></label><label>API Key<input type="password" value={settingsForm.apiKey} placeholder={modelSettings?.hasApiKey?'已保存，留空保持不变':'输入 API Key'} onChange={event=>setSettingsForm(form=>({...form,apiKey:event.target.value}))} autoComplete="new-password"/></label><div className="actions"><button disabled={settingsBusy} onClick={()=>void testModelSettings()}>测试连接</button><button className="primary" disabled={settingsBusy} onClick={()=>void saveModelSettings()}>保存设置</button></div>{settingsMessage&&<p role="status" className="settings-message">{settingsMessage}</p>}<p className="muted">当前：{modelSettings?.configured?`已配置 ${modelSettings.model}`:'未配置'}{modelSettings?.hasApiKey?' · 密钥已保存':''}</p></section></div>}</>;
}
const root=document.getElementById('root')!;
try{createRoot(root).render(<Workbench boot={workbenchBoot.parse(JSON.parse(document.getElementById('workbench-data')?.textContent??''))}/>);}catch{root.textContent='工作台无法加载，请重新进入。';}
