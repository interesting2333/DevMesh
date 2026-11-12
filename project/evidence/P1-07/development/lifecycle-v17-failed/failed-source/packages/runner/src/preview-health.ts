import {request} from 'node:http';
import {RunnerError} from './protocol.js';
/** Only an inspected original container's loopback port may reach this helper. */
export async function probePreviewHealth(endpoint:{host:'127.0.0.1';port:number},timeoutMs=2000):Promise<boolean>{
 if(endpoint.host!=='127.0.0.1'||!Number.isInteger(endpoint.port)||endpoint.port<1024||endpoint.port>65535||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>5000)throw new RunnerError('PREVIEW_HEALTH_TARGET_INVALID',422);
 return new Promise(resolve=>{
  let settled=false;const done=(value:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
  const req=request({host:'127.0.0.1',port:endpoint.port,path:'/api/health',method:'GET',agent:false,headers:{Accept:'application/json',Connection:'close'}},res=>{
   const chunks:Buffer[]=[];let bytes=0;
   if(res.statusCode!==200||!/^application\/json(?:;|$)/i.test(res.headers['content-type']??'')){done(false);res.destroy();return;}
   res.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>4096){done(false);res.destroy();req.destroy();}else chunks.push(chunk);});
   res.on('error',()=>done(false));res.on('aborted',()=>done(false));res.on('end',()=>{try{const body=JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;done(typeof body==='object'&&body!==null&&!Array.isArray(body)&&Object.keys(body).length===1&&'status' in body&&body.status==='ready');}catch{done(false);}});
  });
  const timer=setTimeout(()=>{done(false);req.destroy();},timeoutMs);req.on('error',()=>done(false));req.end();
 });
}
