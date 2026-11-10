import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { ErrorRequestHandler,RequestHandler } from 'express';
import { opaqueKey } from '@devmesh/contracts';
import { RunnerError } from './protocol.js';
import { RunnerManager } from './manager.js';
export interface RunnerIdentity {controllerId:string;credentialRef:string}
export async function serveRunner(manager:RunnerManager,options:{host?:string;port?:number;identities:RunnerIdentity[];credentials:(ref:string)=>Promise<string|undefined>}){
 const host=options.host??'127.0.0.1';if(!['127.0.0.1','::1'].includes(host))throw new RunnerError('RUNNER_BIND_INVALID',422);
 if(new Set(options.identities.map(i=>i.controllerId)).size!==options.identities.length||new Set(options.identities.map(i=>i.credentialRef)).size!==options.identities.length)throw new RunnerError('RUNNER_IDENTITIES_INVALID',422);
 for(const i of options.identities){opaqueKey.parse(i.controllerId);opaqueKey.parse(i.credentialRef);}
 const app=express();app.disable('x-powered-by');app.disable('etag');
 const auth:RequestHandler=async(req,res,next)=>{try{
  const h=req.headers.authorization,presented=Buffer.from(h?.startsWith('Bearer ')?h.slice(7):'');if(presented.length>=16&&presented.length<=4096){const matches:string[]=[];for(const i of options.identities){const value=await options.credentials(i.credentialRef);if(!value||value.length<16)continue;const expected=Buffer.from(value);if(expected.length===presented.length&&timingSafeEqual(expected,presented))matches.push(i.controllerId);}if(matches.length===1){res.locals.controllerId=matches[0];next();return;}}
  res.set('WWW-Authenticate','Bearer').status(401).json({error:'RUNNER_AUTH_REQUIRED'});
 }catch{res.status(503).json({error:'RUNNER_AUTH_UNAVAILABLE'});}};
 app.get('/healthz',(_req,res)=>res.json({status:'ok',component:'devmesh-runner',executionConfigured:manager.backend.configured}));
 app.use('/runner/v1',auth,express.json({limit:'256kb',strict:true}));
 app.post('/runner/v1/jobs',async(req,res)=>res.status(202).json(await manager.submit(String(res.locals.controllerId),req.body)));
 app.get('/runner/v1/jobs/by-operation/:id',async(req,res)=>res.json(await manager.byOperation(String(res.locals.controllerId),String(req.params.id))));
 app.get('/runner/v1/jobs/:id',async(req,res)=>res.json(await manager.get(String(res.locals.controllerId),String(req.params.id))));
 // A literal colon action uses a regexp so it is not parsed as a named parameter.
 app.post(/^\/runner\/v1\/jobs\/(job_[A-Za-z0-9_-]+):stop$/,async(req,res)=>res.status(202).json(await manager.stop(String(res.locals.controllerId),String(req.params[0]))));
 app.post(/^\/runner\/v1\/jobs\/(job_[A-Za-z0-9_-]+):renew$/,async(req,res)=>res.json(await manager.renew(String(res.locals.controllerId),String(req.params[0]),req.body)));
 app.get('/runner/v1/jobs/:id/logs',async(req,res)=>{const offset=Number(req.query.offset??0),limit=Number(req.query.limit??65536);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>65536)throw new RunnerError('RUNNER_LOG_CURSOR_INVALID',422);const job=await manager.get(String(res.locals.controllerId),String(req.params.id));if(!job.outputRefs.length)throw new RunnerError('RUNNER_LOGS_NOT_COLLECTED',409);const {bytes}=await manager.readOutput(String(res.locals.controllerId),job.jobId,0);if(offset>bytes.length)throw new RunnerError('RUNNER_LOG_CURSOR_INVALID',422);const chunk=bytes.subarray(offset,offset+limit);res.json({jobId:job.jobId,offset,nextOffset:offset+chunk.length,complete:offset+chunk.length===bytes.length,data:chunk.toString('base64')});});
 app.get('/runner/v1/jobs/:id/outputs/:index',async(req,res)=>{const index=Number(req.params.index);if(!Number.isSafeInteger(index)||index<0)throw new RunnerError('RUNNER_OUTPUT_NOT_FOUND',404);const {ref,bytes}=await manager.readOutput(String(res.locals.controllerId),String(req.params.id),index);res.set('Content-Type','application/octet-stream').set('X-Content-SHA256',ref.sha256).send(Buffer.from(bytes));});
 app.use((_req,res)=>{res.status(404).json({error:'NOT_FOUND'});});
 const errors:ErrorRequestHandler=(error,_req,res,_next)=>{const invalid=error?.name==='ZodError'||error?.type==='entity.parse.failed';res.status(error instanceof RunnerError?error.status:invalid?422:error?.type==='entity.too.large'?413:500).json({error:error instanceof RunnerError?error.code:invalid?'RUNNER_REQUEST_INVALID':'RUNNER_REQUEST_FAILED'});};app.use(errors);
 const server=createServer({headersTimeout:5000,requestTimeout:10000},app);server.maxRequestsPerSocket=100;
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port??0,host,()=>{server.off('error',reject);resolve();});});
 let closing:Promise<void>|undefined;return {address:server.address() as AddressInfo,close(){return closing??=(async()=>{const closed=new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));server.closeAllConnections();await closed;await manager.close();})();}};
}
