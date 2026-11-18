import {useEffect,useRef,useState} from 'react';
export function ConversationRename({title,busy,onSave,onClose}:{title:string;busy:boolean;onSave:(name:string)=>void;onClose:()=>void}){
 const [name,setName]=useState(title),dialog=useRef<HTMLDialogElement|null>(null),field=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{dialog.current?.showModal();field.current?.select();return()=>dialog.current?.close();},[]);
 return <dialog ref={dialog} className="modal conversation-rename" aria-labelledby="rename-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}><form onSubmit={e=>{e.preventDefault();if(name.trim())onSave(name.trim());}}><h2 id="rename-title">修改任务名称</h2><label htmlFor="conversation-name">名称</label><input ref={field} id="conversation-name" maxLength={80} value={name} disabled={busy} onChange={e=>setName(e.target.value.replace(/[\r\n\t]/g,' '))}/><div className="actions"><button type="button" disabled={busy} onClick={onClose}>取消</button><button className="primary" disabled={busy||!name.trim()||name.trim()===title} type="submit">保存名称</button></div></form></dialog>;
}
