// Actual control/Runner Workers, template HTTP/CRUD and TLS. Physical fencing,
// OCI, routes and identity remain explicit fixtures, never production acceptance.
import {createServer as createHttpsServer,request as httpsRequest} from 'node:https';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {ReleaseGateway} from '../../packages/preview-gateway/dist/index.mjs';
import {RunnerReleaseHttpTransport} from '../../packages/runner/dist/index.mjs';
import {releaseServiceFixture} from './release-service.mjs';
const listen=s=>new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
export async function releaseHttpFixture(t,{gatewayOptions={},storageWrap,transportWrap,webRoot}={}){
 const received=[];let blockResponse,releaseResponse;
 const blocked=new Promise(resolve=>{blockResponse=resolve;}),release=new Promise(resolve=>{releaseResponse=resolve;});
 const f=await releaseServiceFixture(t,{webRoot,httpHook(req,res,{database}){
  if(req.url==='/__test/echo'){received.push({headers:req.headers,path:req.url});res.setHeader('set-cookie','__Host-devmesh-release=escape; Path=/; Secure');res.setHeader('location','https://external.example/');res.setHeader('content-type','application/json');res.end(JSON.stringify(received.at(-1)));return true;}
  if(req.url==='/__test/in-flight'){blockResponse();void release.then(()=>res.end('private in-flight release content'));return true;}
  if(req.url==='/__test/drop-after-write'){void(async()=>{const chunks=[];for await(const c of req)chunks.push(c);const result=database.mutate({kind:'create',key:req.headers['idempotency-key'],input:JSON.parse(Buffer.concat(chunks).toString())});received.push({path:req.url,result});req.socket.destroy();})().catch(()=>req.socket.destroy());return true;}
  return false;
 }}),p=f.publication,observation=await f.backend.publish(p,async()=>true);
 if(observation.state!=='PUBLISHED')throw Error('Fixture publication failed '+JSON.stringify(observation));
 const publication=await f.control.call('recordReleasePublicationObservation',{principalId:f.options.principalId,releaseId:p.releaseId,requestHash:p.requestHash,expectedRevision:p.revision,expectedSequence:p.sequence,observation});
 const key=join(f.data.root,'release-tls.key'),cert=join(f.data.root,'release-tls.crt'),openssl=process.platform==='win32'?'D:\\Git\\usr\\bin\\openssl.exe':'openssl',generated=spawnSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=*.apps.devmesh-app.test','-addext','subjectAltName=DNS:*.apps.devmesh-app.test','-keyout',key,'-out',cert],{encoding:'utf8',windowsHide:true});
 if(generated.status!==0)throw Error('TLS fixture generation failed '+(generated.error?.message??generated.stderr));
 const credentials={key:await readFile(key),cert:await readFile(cert)};let gateway;
 const server=createHttpsServer(credentials,(req,res)=>void gateway.handle(req,res));server.requestTimeout=20000;server.headersTimeout=10000;server.keepAliveTimeout=100;server.on('upgrade',(_req,s)=>s.destroy());server.on('connect',(_req,s)=>s.destroy());await listen(server);
 f.data.cleanup.push(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const transport=new RunnerReleaseHttpTransport(f.backend),storage={request:(m,i)=>f.control.call(m,i)};
 gateway=new ReleaseGateway(storageWrap?storageWrap(storage):storage,transportWrap?transportWrap(transport):transport,{enabled:true,mode:'loopback-development',gatewayId:'release.https.fixture',principalId:'release.https.service',platformOrigin:'https://control.devmesh.test',releaseBaseOrigin:`https://apps.devmesh-app.test:${server.address().port}`,...gatewayOptions});f.data.cleanup.push(()=>gateway.close());
 await f.control.call('registerReleaseAccessPolicy',{principalId:'user_1',projectId:publication.projectId,policy:gateway.policy});
 const request=(origin,path,{method='GET',headers={},body,rawHeaders}={})=>new Promise((resolve,reject)=>{const u=new URL(origin),bytes=typeof body==='string'?Buffer.from(body):body;const req=httpsRequest({hostname:u.hostname,port:u.port,path,method,ca:credentials.cert,agent:false,lookup:(_host,o,cb)=>o.all?cb(null,[{address:'127.0.0.1',family:4}]):cb(null,'127.0.0.1',4),headers:rawHeaders??{...headers,...(bytes?{'content-length':bytes.length}:{})}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});req.on('error',reject);req.setTimeout(15000,()=>req.destroy(Error('Release HTTPS fixture timeout')));req.end(bytes);});
 const subject={principalId:'user_1',runId:publication.runId,releaseId:publication.releaseId},issue=()=>gateway.issueForMember(subject),exchange=ticket=>request(ticket.releaseOrigin,'/__devmesh/release/session',{method:'POST',headers:{origin:gateway.config.platformOrigin,'content-type':'application/json'},body:JSON.stringify({ticket:ticket.ticket,expiresAt:ticket.sessionExpiresAt})}),login=async()=>{const ticket=await issue(),response=await exchange(ticket);if(response.status!==200)throw Error('Release exchange failed '+response.body);return {ticket,origin:ticket.releaseOrigin,cookie:response.headers['set-cookie'][0].split(';')[0],response};};
 return {...f,publication,gateway,transport,request,issue,exchange,login,subject,received,blocked,releaseResponse,rows:()=>f.control.db.prepare('SELECT * FROM release_access_requests ORDER BY sequence').all()};
}
