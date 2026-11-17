import { z } from 'zod';
import { opaqueKey,parseContract } from '@devmesh/contracts';
import type { CredentialResolver } from '@devmesh/a2a-adapter';
import {readDeepSeekStream} from './provider-stream.js';

export class ModelError extends Error {
 constructor(readonly code:string,readonly retryable:boolean,readonly outcome:'not-sent'|'known-failed'|'unknown',message=code){super(message);}
}
export const capabilitiesSchema=z.strictObject({revision:opaqueKey,contextTokens:z.number().int().min(1024),maxOutputTokens:z.number().int().positive(),toolCalls:z.boolean(),structuredOutput:z.enum(['json-object','text-json']),tokenCounting:z.literal('utf8-conservative-v1'),reasoningMode:z.literal('disabled'),verification:z.enum(['DECLARED','VERIFIED']),evidenceRef:z.string().min(1).optional()}).superRefine((v,c)=>{if(v.maxOutputTokens>=v.contextTokens)c.addIssue({code:'custom',message:'Output capacity must be smaller than context capacity'});if(v.verification==='VERIFIED'&&!v.evidenceRef)c.addIssue({code:'custom',message:'Verified capabilities require evidence'});});
export const providerConfigSchema=z.strictObject({providerId:opaqueKey,endpoint:z.url().refine(v=>{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!u.search&&!u.hash&&(u.protocol==='https:'||['127.0.0.1','[::1]','localhost'].includes(u.hostname));},'TLS endpoint or explicit local test endpoint required'),model:opaqueKey,credentialRef:opaqueKey,responseMode:z.enum(['json','sse']).optional(),capabilities:capabilitiesSchema,connectTimeoutMs:z.number().int().min(10).max(120000).default(10000),requestTimeoutMs:z.number().int().min(10).max(300000).default(120000),maximumResponseBytes:z.number().int().min(1024).max(16*1024*1024).default(4*1024*1024)});
export type ProviderConfig=z.input<typeof providerConfigSchema>;
export interface ChatMessage {role:'system'|'user'|'assistant'|'tool';content:string|null;toolCallId?:string;toolCalls?:ToolCall[]}
export interface ToolCall {id:string;name:string;arguments:string}
export interface ToolDefinition {name:string;description:string;parameters:Record<string,unknown>}
export interface ModelRequest {messages:ChatMessage[];tools:ToolDefinition[];maxOutputTokens:number;jsonOutput:boolean}
export interface ModelResponse {content:string;toolCalls:ToolCall[];finishReason:'stop'|'tool_calls'|'length'|'content_filter'|'insufficient_system_resource';requestId:string;usage:{inputTokens:number;outputTokens:number;source:'provider'|'estimated'};model:string;cost:null}
export interface ModelProvider {readonly config:z.output<typeof providerConfigSchema>;complete(request:ModelRequest,signal?:AbortSignal,onDelta?:(text:string)=>void):Promise<ModelResponse>}

export function estimateTokens(value:unknown):number{
 const r=value as {messages?:ChatMessage[];tools?:ToolDefinition[]}|null;
 const framing=r&&typeof r==='object'?128*((r.messages?.length??0)+(r.tools?.length??0)+(r.messages?.reduce((n,m)=>n+(m.toolCalls?.length??0),0)??0)):0;
 return Buffer.byteLength(JSON.stringify(value),'utf8')+1024+framing;
}
export function checkModelRequest(config:z.output<typeof providerConfigSchema>,r:ModelRequest){
 if(!Number.isSafeInteger(r.maxOutputTokens)||r.maxOutputTokens<1||r.maxOutputTokens>config.capabilities.maxOutputTokens)throw new ModelError('MODEL_OUTPUT_LIMIT',false,'not-sent');
 if(r.tools.length&&!config.capabilities.toolCalls)throw new ModelError('MODEL_TOOL_CAPABILITY_UNAVAILABLE',false,'not-sent');
 if(r.tools.some(t=>!/^[A-Za-z0-9_-]{1,128}$/.test(t.name))||new Set(r.tools.map(t=>t.name)).size!==r.tools.length)throw new ModelError('MODEL_TOOL_NAME_INVALID',false,'not-sent');
 if(r.jsonOutput&&config.capabilities.structuredOutput!=='json-object')throw new ModelError('MODEL_JSON_CAPABILITY_UNAVAILABLE',false,'not-sent');
 if(estimateTokens({messages:r.messages,tools:r.tools})+r.maxOutputTokens>config.capabilities.contextTokens)throw new ModelError('CONTEXT_LIMIT',false,'not-sent');
 if(!r.messages.length||r.messages.some(m=>!['system','user','assistant','tool'].includes(m.role)||!(m.content===null||typeof m.content==='string')||(m.role==='tool'&&!m.toolCallId)))throw new ModelError('MODEL_REQUEST_INVALID',false,'not-sent');
}
const toolCallSchema=z.object({id:z.string().min(1).max(256),type:z.literal('function'),function:z.object({name:z.string().min(1).max(128),arguments:z.string().max(1024*1024)})});
const responseSchema=z.object({id:z.string().min(1).max(512),model:z.string().min(1),choices:z.array(z.object({index:z.number().int(),finish_reason:z.enum(['stop','tool_calls','length','content_filter','insufficient_system_resource']),message:z.object({role:z.literal('assistant'),content:z.string().nullable().optional(),tool_calls:z.array(toolCallSchema).max(128).nullable().optional()})})).length(1),usage:z.object({prompt_tokens:z.number().int().nonnegative(),completion_tokens:z.number().int().nonnegative()}).optional()});
export class DeepSeekProvider implements ModelProvider {
 readonly config:z.output<typeof providerConfigSchema>;
 constructor(config:ProviderConfig,readonly credentials:CredentialResolver){const parsed=parseContract(providerConfigSchema,config);Object.freeze(parsed.capabilities);this.config=Object.freeze(parsed);}
 async complete(request:ModelRequest,signal?:AbortSignal,onDelta?:(text:string)=>void):Promise<ModelResponse>{
  checkModelRequest(this.config,request);
  let key:string|undefined;try{key=await this.credentials(this.config.credentialRef);}catch{throw new ModelError('MODEL_AUTH_UNAVAILABLE',false,'not-sent');}if(!key)throw new ModelError('MODEL_NOT_CONFIGURED',false,'not-sent');
  if(signal?.aborted)throw new ModelError('MODEL_ABORTED',false,'not-sent');
  const c=this.config,body={model:c.model,messages:request.messages.map(m=>({role:m.role,content:m.content,...(m.toolCallId?{tool_call_id:m.toolCallId}:{}),...(m.toolCalls?.length?{tool_calls:m.toolCalls.map(t=>({id:t.id,type:'function',function:{name:t.name,arguments:t.arguments}}))}:{})})),max_tokens:request.maxOutputTokens,stream:c.responseMode==='sse',...(c.responseMode==='sse'?{stream_options:{include_usage:true}}:{}),thinking:{type:'disabled'},...(request.tools.length?{tools:request.tools.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.parameters}}))}:{}),...(request.jsonOutput?{response_format:{type:'json_object'}}:{})};
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  let sent=false,timedOut=false;const connectionTimer=setTimeout(()=>{timedOut=true;controller.abort();},c.connectTimeoutMs),timer=setTimeout(()=>{timedOut=true;controller.abort();},c.requestTimeoutMs);connectionTimer.unref();timer.unref();
  try{
   sent=true;const response=await fetch(c.endpoint.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:controller.signal});clearTimeout(connectionTimer);
   if(!response.ok){await response.body?.cancel();throw new ModelError(response.status===401||response.status===403?'MODEL_AUTH_REQUIRED':response.status===429?'MODEL_RATE_LIMITED':response.status>=500?'MODEL_PROVIDER_UNAVAILABLE':'MODEL_REQUEST_REJECTED',response.status===429||response.status>=500,'known-failed');}
   if(!response.body)throw new ModelError('MODEL_RESPONSE_INVALID',false,'unknown');
   let raw:unknown;
   if(c.responseMode==='sse'){
    if(!/^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type')??'')){await response.body.cancel();throw new ModelError('MODEL_RESPONSE_INVALID',false,'unknown');}
    raw=await readDeepSeekStream(response.body,c.maximumResponseBytes,c.model,onDelta,code=>{throw new ModelError(code,false,'unknown');});
   }else{
    const chunks:Uint8Array[]=[];let bytes=0;const reader=response.body.getReader();
    try{for(;;){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>c.maximumResponseBytes)throw new ModelError('MODEL_RESPONSE_TOO_LARGE',false,'unknown');chunks.push(r.value);}}finally{await reader.cancel();}
    try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new ModelError('MODEL_RESPONSE_INVALID',false,'unknown');}
   }
   const decoded=responseSchema.safeParse(raw);if(!decoded.success)throw new ModelError('MODEL_RESPONSE_INVALID',false,'unknown');
   const d=decoded.data,choice=d.choices[0]!,toolCalls=(choice.message.tool_calls??[]).map(t=>({id:t.id,name:t.function.name,arguments:t.function.arguments}));
   if(d.model!==c.model)throw new ModelError('MODEL_ID_MISMATCH',false,'unknown');
   if(new Set(toolCalls.map(t=>t.id)).size!==toolCalls.length||(choice.finish_reason==='tool_calls'&&!toolCalls.length)||(choice.finish_reason==='stop'&&toolCalls.length))throw new ModelError('MODEL_TOOL_CALLS_INVALID',false,'unknown');
   const content=choice.message.content??'';
   return {content,toolCalls,finishReason:choice.finish_reason,requestId:d.id,usage:d.usage?{inputTokens:d.usage.prompt_tokens,outputTokens:d.usage.completion_tokens,source:'provider'}:{inputTokens:estimateTokens({messages:request.messages,tools:request.tools}),outputTokens:estimateTokens({content,toolCalls}),source:'estimated'},model:d.model,cost:null};
  }catch(error){if(error instanceof ModelError)throw error;throw new ModelError(timedOut?'MODEL_TIMEOUT':signal?.aborted?'MODEL_ABORTED':'MODEL_TRANSPORT_FAILURE',false,sent?'unknown':'not-sent');}
  finally{clearTimeout(connectionTimer);clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
}
