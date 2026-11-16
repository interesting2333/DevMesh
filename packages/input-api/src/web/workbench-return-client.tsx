import {workbenchReturnBoot,workbenchReturnTarget} from './workbench-reading.js';
try{
 const data=document.getElementById('workbench-return-data'),link=document.getElementById('workbench-return');
 if(data&&link instanceof HTMLAnchorElement){
  const target=workbenchReturnTarget(workbenchReturnBoot.parse(JSON.parse(data.textContent??'')));
  if(target!==null)link.href=target;
 }
}catch{/* Keep the server's authorized canonical Run link if no valid return position exists. */}
