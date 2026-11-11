import {Message,SendMessageRequest,Task} from '@a2a-js/sdk';
import {ClientFactory,JsonRpcTransportFactory,DefaultAgentCardResolver} from '@a2a-js/sdk/client';
import {parseContract,preparationDelegation,workDelegation} from '@devmesh/contracts';
import type {EndpointConfig} from '@devmesh/storage-sqlite';

/** Bind the client to the resolved, checked card and transport URLs. */
async function boundClient(endpoint:EndpointConfig,token:string,signal:AbortSignal){
  const card=new URL(endpoint.cardUrl),allowed=new Set([card.href,new URL(endpoint.address).href]);
  const fetchImpl:typeof fetch=async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:input).href;
    if(!allowed.has(url))throw new Error('Preparation transport URL changed');
    const headers=new Headers(init?.headers);headers.set('Authorization','Bearer '+token);
    const deadline=AbortSignal.timeout(10000);
    return fetch(input,{...init,headers,redirect:'error',signal:AbortSignal.any([signal,deadline,...(init?.signal?[init.signal]:[])])});
  };
  const factory=new ClientFactory({transports:[new JsonRpcTransportFactory({fetchImpl})],cardResolver:new DefaultAgentCardResolver({fetchImpl})});
  return factory.createFromUrl(card.origin,card.pathname);
}
export async function preparationClient(endpoint:EndpointConfig,token:string,signal:AbortSignal){
  const client=await boundClient(endpoint,token,signal);
  return async(input:unknown)=>{
    const delegation=parseContract(preparationDelegation,input);
    if(delegation.endpointId!==endpoint.endpointId||delegation.endpointRevision!==endpoint.revision)throw new Error('Preparation binding changed');
    const message=Message.fromJSON({messageId:delegation.preparationAttemptId,role:'ROLE_USER',parts:[{data:delegation}]});
    const response=await client.sendMessage(SendMessageRequest.fromJSON({message:Message.toJSON(message)}));
    if(!('id' in response))throw new Error('Preparation requires a durable A2A Task');
    return Task.toJSON(response);
  };
}
export async function scheduledWorkClient(endpoint:EndpointConfig,token:string,signal:AbortSignal){
  const client=await boundClient(endpoint,token,signal);
  return async(input:unknown)=>{
    const d=parseContract(workDelegation,input);
    if(d.endpointId!==endpoint.endpointId||d.endpointRevision!==endpoint.revision)throw new Error('Scheduled endpoint binding changed');
    const message=Message.fromJSON({messageId:d.operationId,role:'ROLE_USER',parts:[{data:d}]});
    const result=await client.sendMessage(SendMessageRequest.fromJSON({message:Message.toJSON(message)}));
    if(!('id' in result))throw new Error('Scheduled Work requires a durable A2A Task');
    return Task.toJSON(result);
  };
}
