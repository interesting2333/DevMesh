import {useState} from 'react';
import {attachmentView,inputOperation} from '@devmesh/contracts';
import {uploadResponse} from './workbench-upload.js';
import type {LocalUpload} from './workbench-upload.js';
import type {openWorkbenchLocal} from './workbench-local.js';
import type {WorkbenchCommand,WorkbenchRead} from './workbench-api.js';

type Store=Awaited<ReturnType<typeof openWorkbenchLocal>>;
const known=(v:LocalUpload)=>v.receipt?.status==='SUCCEEDED'||v.receipt?.status==='FAILED';

/** Exact stored bytes and identity; callers trigger every send explicitly. */
export async function sendUploadOriginal(store:Store,key:string,write:WorkbenchCommand,read:WorkbenchRead){
 const v=await store.getUpload(key);
 if(!v||v.bytes===null||v.receipt?.status==='FAILED')throw Error('Original upload cannot be sent');
 const e=v.envelope,form=new FormData();
 form.append('clientAttachmentId',e.metadata.clientAttachmentId);
 form.append('file',new Blob([new Uint8Array(v.bytes)],{type:e.mime}),e.metadata.name);
 const response=uploadResponse.parse(await write(e.path,{method:'POST',headers:{'idempotency-key':e.key},body:form}));
 const observed=await store.observeUpload(key,response);
 return verifySelectedUpload(store,observed,read);
}

/** A successful upload receipt alone is not a current READY observation. */
export async function verifySelectedUpload(store:Store,v:LocalUpload,read:WorkbenchRead){
 if(v.receipt?.status!=='SUCCEEDED')return v;
 const result=v.receipt.result as {attachmentId:string};
 const observed=attachmentView.parse(await read('/api/v1/attachments/'+encodeURIComponent(result.attachmentId)));
 return store.verifyUpload(v.key,v.revision,observed);
}

export async function lookupUploadOriginal(store:Store,key:string,read:WorkbenchRead){
 const v=await store.getUpload(key);if(!v)throw Error('Missing upload original');
 const result=inputOperation.parse(await read('/api/v1/operations/lookup?scope=uploads&key='+encodeURIComponent(v.key)));
 const observed=await store.observeUpload(key,result);
 return verifySelectedUpload(store,observed,read);
}

export function uploadSummary(v:LocalUpload){
 if(v.attachment?.state==='REMOVED')return '附件已被移除，不能提交；本机原记录保留。';
 if(v.receipt?.status==='FAILED')return '上传未完成，原记录保留。可重新选择文件开始新的上传。';
 if(v.receipt?.status==='SUCCEEDED')return v.attachment?.state==='READY'?'上次核实可用；提交前会再次核实。':'上传已保存，仍需核实附件状态。';
 return '上传结果待核实，原文件和请求身份保留。可明确发送或核实原上传。';
}

type Props={
 selected:LocalUpload[];library:LocalUpload[]|null;memory:File|null;
 busy:boolean;editable:boolean;problem:string;status:string;
 onChoose:(file:File)=>void;onRetryMemory:()=>void;onDiscardMemory:()=>void;
 onSend:(key:string)=>void;onLookup:(key:string)=>void;onUnlink:(key:string)=>void;
 onLibrary:()=>void;onRelease:(key:string)=>void;onCopy:(key:string)=>void;
};

export function AttachmentControls(p:Props){
 const [discard,setDiscard]=useState(false),[release,setRelease]=useState<string|null>(null);
 function record(v:LocalUpload,selected:boolean){
  const canCopy=known(v)&&v.bytes!==null;
  return <article className="card" key={v.key} aria-label={(selected?'已选附件：':'上传记录：')+v.envelope.metadata.name}>
   <p><strong>{v.envelope.metadata.name}</strong> · {v.envelope.byteSize.toLocaleString('zh-CN')} 字节</p>
   <p>{uploadSummary(v)}</p>{v.bytes===null&&<p className="muted">本机原文件字节已释放，上传记录仍保留。</p>}
   <div className="actions">
    <button type="button" disabled={p.busy} onClick={()=>p.onLookup(v.key)}>核实此原上传</button>
    {!known(v)&&v.bytes!==null&&<button type="button" disabled={p.busy} onClick={()=>p.onSend(v.key)}>使用此原文件上传</button>}
    {selected&&<button type="button" disabled={!p.editable||p.busy||p.memory!==null} onClick={()=>p.onUnlink(v.key)}>从本次输入移除</button>}
    {!selected&&canCopy&&<button type="button" disabled={!p.editable||p.busy||p.memory!==null||p.selected.length>=3} onClick={()=>p.onCopy(v.key)}>作为新附件添加</button>}
    {!selected&&known(v)&&v.bytes!==null&&<button type="button" disabled={p.busy} onClick={()=>setRelease(v.key)}>释放本机原文件</button>}
   </div>
   {release===v.key&&<div className="notice"><p>释放后无法再从本机记录复制此文件，上传记录和服务端附件保留。确认释放？</p><div className="actions"><button type="button" disabled={p.busy} onClick={()=>{setRelease(null);p.onRelease(v.key);}}>确认释放本机原文件</button><button type="button" disabled={p.busy} onClick={()=>setRelease(null)}>保留原文件</button></div></div>}
  </article>;
 }
 return <section className="attachments" aria-label="输入附件">
  <h3>附件（{p.selected.length}/3）</h3>
  <p className="muted">支持 UTF-8 文本 .txt、.md、.markdown，每个不超过 2 MiB。选择后先保存在本机，由你明确上传；刷新不会自动上传。</p>
  <label htmlFor="input-file">添加一个附件</label><input id="input-file" type="file" accept=".txt,.md,.markdown" disabled={!p.editable||p.busy||p.memory!==null||p.selected.length>=3} onChange={e=>{const file=e.target.files?.[0];if(file){p.onChoose(file);e.target.value='';}}}/>
  {p.memory&&<section className="notice" aria-label="尚未保存的文件"><p>尚未保存的文件：{p.memory.name} · {p.memory.size.toLocaleString('zh-CN')} 字节。文件仍在本页；保存成功或明确放弃前，不能切换或提交。</p><div className="actions"><button type="button" disabled={p.busy} onClick={p.onRetryMemory}>重试保存此文件</button><label><input type="checkbox" disabled={p.busy} checked={discard} onChange={e=>setDiscard(e.target.checked)}/>我确认放弃此未保存文件</label><button type="button" disabled={p.busy||!discard} onClick={()=>{setDiscard(false);p.onDiscardMemory();}}>放弃此未保存文件</button></div></section>}
  {p.status&&<p role="status">{p.status}</p>}{p.problem&&<p className="notice" role="alert">{p.problem}</p>}
  {p.selected.map(v=>record(v,true))}
  <p className="muted">从本次输入移除只取消本机选择。已上传文件和原上传记录仍保留；不会删除服务端文件。</p>
  <button type="button" disabled={p.busy} onClick={p.onLibrary}>{p.library?'重新读取本机上传记录':'查看本机上传记录'}</button>
  {p.library&&<section aria-label="本机上传记录"><h4>本机上传记录</h4><p className="muted">仅当前身份可见。最多保存 32 份文件字节和 256 条原记录；已知结果的原文件可明确释放。再次使用文件会建立独立上传，原记录仍保留。</p>{p.library.filter(v=>!p.selected.some(s=>s.key===v.key)).map(v=>record(v,false))}{!p.library.length&&<p>尚无本机上传记录。</p>}</section>}
 </section>;
}
