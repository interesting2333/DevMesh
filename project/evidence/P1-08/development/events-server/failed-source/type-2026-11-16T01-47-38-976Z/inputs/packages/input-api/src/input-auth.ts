import type {IncomingMessage} from 'node:http';
import type {TLSSocket} from 'node:tls';
import {opaqueKey,parseContract} from '@devmesh/contracts';
import {StorageError} from '@devmesh/storage-sqlite';

export interface Identity {principalId:string}
/** Both Express HTTP requests and upgrade requests share the Node request boundary. */
export type IdentityResolver=(request:IncomingMessage,context:{signal:AbortSignal})=>Identity|null|Promise<Identity|null>;
const fail=(code:string,status:number,message:string):never=>{throw new StorageError(code,status,message);};

function boundary(request:IncomingMessage,upgrade:boolean):void{
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress??''))fail('REQUEST_ORIGIN_INVALID',403,'Input API requires its configured local transport');
 for(const name of ['host','origin','authorization','cookie','idempotency-key','if-match','x-devmesh-principal',...(upgrade?['sec-websocket-key','sec-websocket-version','sec-websocket-protocol','upgrade','connection']:[])]){
  let count=0;for(let i=0;i<request.rawHeaders.length;i+=2)if(request.rawHeaders[i]!.toLowerCase()===name)count++;
  if(count>1)fail('REQUEST_HEADERS_INVALID',400,'Ambiguous request headers');
 }
 const host=request.socket.localAddress==='::1'?`[::1]:${request.socket.localPort}`:`127.0.0.1:${request.socket.localPort}`;
 if(request.headers.host!==host)fail('REQUEST_HOST_INVALID',403,'Unexpected request host');
 const origin=((request.socket as TLSSocket).encrypted?'https':'http')+'://'+host;
 if(upgrade?request.headers.origin!==origin:request.headers.origin!==undefined&&request.headers.origin!==origin)fail('REQUEST_ORIGIN_INVALID',403,'Unexpected request origin');
 if(request.headers['sec-fetch-site']==='cross-site')fail('REQUEST_ORIGIN_INVALID',403,'Cross site input is not allowed');
 if(request.headers.cookie!==undefined)fail('COOKIE_AUTH_NOT_CONFIGURED',401,'Cookie authentication is not configured');
}

export function createInputAuthenticator(resolver:IdentityResolver|undefined){
 const controllers=new Set<AbortController>();let accepting=true;
 return {
  async authenticate(request:IncomingMessage,options:{upgrade?:boolean;expectedPrincipalId?:string;signal?:AbortSignal}={}):Promise<Identity>{
   if(!accepting)fail('SERVICE_STOPPING',503,'Input API is stopping');boundary(request,options.upgrade===true);
   if(!resolver)fail('IDENTITY_NOT_CONFIGURED',503,'Identity provider is not configured');
   const controller=new AbortController();controllers.add(controller);
   const timer=setTimeout(()=>controller.abort(new StorageError('SERVICE_UNAVAILABLE',503,'Identity deadline exceeded')),15000);timer.unref();
   const disconnected=()=>controller.abort(new StorageError('SERVICE_STOPPING',503,'Identity request was disconnected'));
   const external=()=>controller.abort(options.signal!.reason);
   request.socket.once('close',disconnected);request.once('aborted',disconnected);
   if(options.signal?.aborted)external();else options.signal?.addEventListener('abort',external,{once:true});
   let abortListener:(()=>void)|undefined;
   try{
    if(controller.signal.aborted)throw controller.signal.reason;
    const identity=await Promise.race([Promise.resolve().then(()=>resolver!(request,{signal:controller.signal})),new Promise<never>((_resolve,reject)=>{abortListener=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',abortListener,{once:true});})]);
    if(!accepting)fail('SERVICE_STOPPING',503,'Input API is stopping');
    if(!identity)fail('AUTHENTICATION_REQUIRED',401,'Authentication is required');
    const principalId=parseContract(opaqueKey,identity.principalId);
    for(const expected of [request.headers['x-devmesh-principal'],options.expectedPrincipalId])if(expected!==undefined&&parseContract(opaqueKey,expected)!==principalId)fail('FORBIDDEN',403,'Page identity has changed');
    return {principalId};
   }finally{clearTimeout(timer);request.socket.off('close',disconnected);request.off('aborted',disconnected);options.signal?.removeEventListener('abort',external);if(abortListener)controller.signal.removeEventListener('abort',abortListener);controllers.delete(controller);}
  },
  stop(){accepting=false;for(const controller of controllers)controller.abort(new StorageError('SERVICE_STOPPING',503,'Input API is stopping'));},
 };
}
