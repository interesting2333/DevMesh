import {useEffect,useRef,useState} from 'react';
import {attachmentView} from '@devmesh/contracts';
import type {ConversationMessage as Message} from '@devmesh/contracts';
import {ConversationText} from './conversation-text.js';
import {WorkbenchIcon as Icon} from './workbench-icons.js';
export function ConversationMessage({message,read,needsAnswer=false}:{message:Message;read:(path:string)=>Promise<unknown>;needsAnswer?:boolean}){
 const [names,setNames]=useState<string[]>([]),[copied,setCopied]=useState(false),reader=useRef(read);reader.current=read;
 useEffect(()=>{let stop=false;void Promise.allSettled(message.attachmentIds.map(async id=>attachmentView.parse(await reader.current('/api/v1/attachments/'+encodeURIComponent(id))).name)).then(results=>{if(!stop)setNames(results.map((r,i)=>r.status==='fulfilled'?r.value:'附件 '+(i+1)));});return()=>{stop=true;};},[message.messageId]);
 const content=<>{message.role==='user'?<p>{message.text}</p>:<ConversationText text={message.text}/ >}{names.length>0&&<div className="message-files">{names.map((name,i)=><span key={i}><Icon name="paperclip"/>{name}</span>)}</div>}</>;
 if(message.role==='progress')return <details className="chat-message chat-progress" open={needsAnswer||undefined}><summary><Icon name="task"/><span>{message.text.split('\n').find(v=>v.trim())?.replace(/^#+\s*/,'')??'任务进展'}</span><Icon name="chevron"/></summary>{content}</details>;
 return <article className={'chat-message chat-'+message.role}><div className="chat-author"><Icon name={message.role==='user'?'chat':'mesh'}/>{message.role==='user'?'你':'DevMesh'}</div>{content}{message.role==='assistant'&&<button className="message-copy" aria-label="复制回复" onClick={()=>{void navigator.clipboard.writeText(message.text).then(()=>setCopied(true)).catch(()=>setCopied(false));}}>{copied?'已复制':'复制'}</button>}</article>;
}
