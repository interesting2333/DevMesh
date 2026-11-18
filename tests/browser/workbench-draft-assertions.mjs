import assert from 'node:assert/strict';

/** Assert the actual durable value now that normal auto-save is visually silent. */
export async function waitForWorkbenchDraft(page){
 const deadline=Date.now()+15000;
 while(Date.now()<deadline){
  const saved=await page.evaluate(()=>new Promise(resolve=>{
   const field=document.getElementById('input-text');if(!(field instanceof HTMLTextAreaElement)){resolve(false);return;}
   const label=field.closest('.composer')?.getAttribute('aria-label'),form=label==='新任务目标'?'task':label==='新项目输入'?'project':'message',text=field.value;
   const title=document.getElementById('task-title'),kind=document.getElementById('task-kind');
   const request=indexedDB.open('devmesh.workbench',2);
   request.onerror=()=>resolve(false);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('drafts')){db.close();resolve(false);return;}const tx=db.transaction('drafts'),read=tx.objectStore('drafts').getAll();let matches=false;
    read.onsuccess=()=>{matches=read.result.some(d=>d.context.form===form&&d.text===text&&(form!=='task'||d.task?.title===title?.value&&d.task?.kind===(kind?.value||null)));};
    tx.oncomplete=()=>{db.close();resolve(matches);};tx.onabort=()=>{db.close();resolve(false);};};
  }));
  if(saved)return;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 assert.fail('Current composer draft did not commit to native IndexedDB');
}
