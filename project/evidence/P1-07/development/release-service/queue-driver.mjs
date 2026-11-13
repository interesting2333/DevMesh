import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const root='.cache/p1-07/release-service-',record={startedAt:new Date().toISOString(),checks:[]};
writeFileSync(root+'queue-driver.mjs',readFileSync(new URL(import.meta.url)));
function save(){writeFileSync(root+'queue.json',JSON.stringify(record,null,2)+'\n');}
save();
while(true){
 const p=root+'service-06/report.json';
 if(existsSync(p)){
  const r=JSON.parse(readFileSync(p));
  if(Array.isArray(r.emittedChanges)&&Array.isArray(r.inputChanges)){
   if(r.checks.some(c=>c.exitCode!==0)||r.inputChanges.length||r.emittedChanges.length)throw Error('Service verification did not finish on stable passing inputs');
   record.prerequisite='service-06';save();break;
  }
 }
 await new Promise(resolve=>setTimeout(resolve,1000));
}
// One heavy test group at a time; preserve each original report on failure.
for(const [attempt,args] of [
 ['acceptance-06',['tests','tests/acceptance-preparation-backend.test.mjs','tests/acceptance-datasets.test.mjs','tests/release-publication.test.mjs']],
 ['runner-06',['baseline-runner']],
 ['verify-06',['verify']]
]){
 const child=spawn(process.execPath,['.cache/p122-run.mjs',attempt,...args],{windowsHide:true,stdio:['ignore','inherit','inherit']});
 const item={attempt,pid:child.pid,startedAt:new Date().toISOString()};record.checks.push(item);save();
 const result=await new Promise(resolve=>{child.on('error',e=>resolve({exitCode:null,error:e.message}));child.on('close',(exitCode,signal)=>resolve({exitCode,signal}));});
 Object.assign(item,result,{finishedAt:new Date().toISOString()});save();if(result.exitCode!==0){process.exitCode=1;break;}
}
record.finishedAt=new Date().toISOString();save();
