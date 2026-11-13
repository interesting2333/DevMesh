import {createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {canonical,releaseAccessTarget,releaseAccessHttpRequest,releaseTargetForPublication,releaseAccessRequestHash} from '@devmesh/storage-sqlite';
import type {ReleaseAccessTarget,ReleaseAccessRecord} from '@devmesh/storage-sqlite';
import {RunnerError} from './protocol.js';
import type {RunnerReleaseServiceBackend} from './release-service-backend.js';
export interface ReleaseHttpInput {record:ReleaseAccessRecord;headers:Record<string,string>;body:Uint8Array;signal:AbortSignal;authorize:()=>Promise<boolean>}
export interface ReleaseHttpResult {status:number;headers:Record<string,string|string[]>;body:Uint8Array}
export interface ReleaseHttpTransport {readonly configured:boolean;check(target:ReleaseAccessTarget):Promise<{checkedAt:string}>;forward(input:ReleaseHttpInput):Promise<ReleaseHttpResult>}
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const allowedHeaders=new Set(['accept','accept-language','content-type','if-match','if-none-match','range','idempotency-key']);
/** Explicit Runner-local composition. A saved publication is identity, never live health. */
export class RunnerReleaseHttpTransport implements ReleaseHttpTransport {
 constructor(readonly backend:RunnerReleaseServiceBackend,readonly maximumResponseBytes=4*1024*1024,readonly timeoutMs=15000){
  if(!Number.isSafeInteger(maximumResponseBytes)||maximumResponseBytes<1024||maximumResponseBytes>16*1024*1024||!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)throw new RunnerError('RELEASE_HTTP_LIMIT_INVALID',422,'not-sent');
 }
 get configured(){return this.backend.configured;}
 async check(target:ReleaseAccessTarget):Promise<{checkedAt:string}>{
  try{
   const t=releaseAccessTarget.parse(target),o=this.backend.options;
   if(!this.configured||t.runnerId!==o.runnerId||t.controllerId!==o.controllerId||t.backendRef!==o.backendRef)throw new Error('identity');
   const started=Date.now(),p=await this.backend.control.request('getReleasePublication',{principalId:o.principalId,releaseId:t.releaseId});
   if(canonical(releaseTargetForPublication(p))!==canonical(t))throw new Error('publication');
   const observed=await this.backend.inspect(p);
   if(observed.state!=='PUBLISHED'||sha(canonical(observed.proof))!==t.publicationProofHash||observed.current.service.state!=='HEALTHY'||observed.current.service.instanceId!==t.instanceId||observed.current.service.profileHash!==t.profileHash||observed.current.service.claimHash!==t.claimHash||canonical(observed.current.service.endpoint)!==canonical(t.endpoint)||observed.current.route.routeHash!==t.routeHash||observed.current.route.generation!==t.routeGeneration)throw new Error('health');
   if(Date.parse(observed.checkedAt)<started||Date.parse(observed.checkedAt)>Date.now())throw new Error('stale health');
   const j=await this.backend.store.request('releaseServiceGet',{controllerId:o.controllerId,releaseId:t.releaseId,requestHash:t.serviceRequestHash}),r=j.reservation;
   if(!r||r.state!=='ACTIVE'||r.releasedAt!==null||r.reservationId!==t.reservationId||r.claimHash!==t.claimHash||j.profileHash!==t.profileHash||j.proofHash!==t.publicationProofHash||j.containerId!==t.instanceId||j.networkId!==t.networkId||r.fact?.state!=='HEALTHY'||r.fact.instanceId!==t.instanceId||canonical(r.fact.endpoint)!==canonical(t.endpoint))throw new Error('journal');
   return {checkedAt:observed.checkedAt};
  }catch{throw new RunnerError('RELEASE_HTTP_ORIGINAL_UNVERIFIED',503,'not-sent');}
 }
 async forward(input:ReleaseHttpInput):Promise<ReleaseHttpResult>{
  const {record,headers,body,signal}=input,t=record.target;
  let request:ReleaseAccessRecord['request'];
  try{
   request=releaseAccessHttpRequest.parse(record.request);
   if(record.state!=='DISPATCHED'||record.requestHash!==releaseAccessRequestHash(record)||request.headersSha256!==sha(canonical(headers))||request.bodySha256!==sha(body)||body.byteLength>1024*1024)throw new Error('request');
   for(const [name,value] of Object.entries(headers))if(!allowedHeaders.has(name)||/[\r\n\0]/.test(value)||value.length>8192)throw new Error('headers');
   if(signal.aborted)throw new Error('aborted');
   await this.check(t);
   if(signal.aborted||!await input.authorize())throw new Error('authorization');
  }catch{throw new RunnerError('RELEASE_HTTP_NOT_SENT',503,'not-sent');}
    // No URL parser, DNS resolution, redirect following, connection pooling or retry.
    // Once an HTTP request is constructed, every incomplete result is UNKNOWN.
    return new Promise<ReleaseHttpResult>((resolve, reject) => {
      let settled = false;
      const fail = () => {if (!settled) {settled = true; reject(new RunnerError('RELEASE_HTTP_OUTCOME_UNKNOWN', 502, 'unknown'));}};
      const req = httpRequest({host: '127.0.0.1', port: t.endpoint.port, method: request.method, path: request.path, agent: false, signal, headers: {...headers, host: `127.0.0.1:${t.endpoint.port}`, 'content-length': body.byteLength}}, res => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode > 599) {res.destroy(); fail(); return;}
        const chunks: Buffer[] = []; let size = 0;
        res.on('data', (chunk: Buffer) => {size += chunk.length; if (size > this.maximumResponseBytes) {res.destroy(); req.destroy(); fail();} else chunks.push(chunk);});
        res.on('error', fail);
        res.on('aborted', fail);
        res.on('end', () => {
          if (settled) return;
          if (!res.complete) {fail(); return;}
          settled = true;
          const responseHeaders: Record<string, string | string[]> = {};
          for (const [name, value] of Object.entries(res.headers)) if (value !== undefined) responseHeaders[name] = value;
          resolve({status: res.statusCode!, headers: responseHeaders, body: Buffer.concat(chunks)});
        });
      });
      req.on('error', fail);
      req.on('upgrade', (_res, socket) => {socket.destroy(); fail();});
      const timer = setTimeout(() => {req.destroy(); fail();}, this.timeoutMs);
      timer.unref();
      req.on('close', () => clearTimeout(timer));
      req.end(body);
    });
  }
}
