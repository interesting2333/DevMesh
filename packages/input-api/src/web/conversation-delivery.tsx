import {useEffect,useState} from 'react';
import {workbenchDeliveryView} from '@devmesh/contracts';
import type {z} from 'zod';

/** Only saved delivery facts are shown. Target pages recheck current permissions. */
export function ConversationDelivery({projectId,runId,read}:{projectId:string;runId:string;read:(path:string)=>Promise<unknown>}){
 const [value,setValue]=useState<z.output<typeof workbenchDeliveryView>|null>(null);
 useEffect(()=>{
  let stopped=false;setValue(null);
  const poll=async()=>{while(!stopped){try{
   const next=workbenchDeliveryView.parse(await read('/api/v1/projects/'+encodeURIComponent(projectId)+'/runs/'+encodeURIComponent(runId)+'/delivery?limit=20'));
   if(next.projectId!==projectId||next.runId!==runId)throw Error('Delivery context changed');
   if(!stopped)setValue(next);
  }catch{if(!stopped)setValue(null);}await new Promise(resolve=>setTimeout(resolve,3000));}};
  void poll();return()=>{stopped=true;};
 },[projectId,runId]);
 if(!value||!value.candidates.length&&!value.acceptedRelease)return null;
 const release=value.acceptedRelease;
 return <section className="chat-message chat-progress" aria-label="已保存成果"><div className="chat-author">已保存成果</div>
  {value.candidates.slice(-3).map(c=>{const path='/api/v1/runs/'+encodeURIComponent(runId)+'/candidates/'+encodeURIComponent(c.candidateId);return <article className="card" key={c.candidateId}><strong>候选版本 {c.revision}</strong><p className="muted">{c.qualification==='CURRENT'?'自动检查已通过，可继续审阅。':'对应先前依据，可查看历史记录。'}</p><div className="actions"><a href={path+'/preview-management/view'} target="_blank" rel="noreferrer">预览与数据</a><a href={path+'/review/view'} target="_blank" rel="noreferrer">审阅检查结果</a></div></article>;})}
  {release&&<article className="card"><strong>项目已接受版本</strong><p className="muted">{release.runId===runId?'来自本轮执行。':'来自之前的执行。'}</p><div className="actions"><a href={'/api/v1/runs/'+encodeURIComponent(release.runId)+'/releases/'+encodeURIComponent(release.releaseId)+'/view'} target="_blank" rel="noreferrer">查看版本</a><a href={'/api/v1/releases/'+encodeURIComponent(release.releaseId)+'/exports/view'} target="_blank" rel="noreferrer">交付包</a></div></article>}
 </section>;
}
