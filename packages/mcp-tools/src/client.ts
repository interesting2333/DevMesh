import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { canonical } from '@devmesh/storage-sqlite';
import { executionPermit } from '@devmesh/contracts';
import { ToolError,toolResult } from './protocol.js';
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}};
class TrackingTransport extends StreamableHTTPClientTransport {negotiated='';override setProtocolVersion(value:string){super.setProtocolVersion(value);this.negotiated=value;}}
export interface ConnectionSnapshot {endpointId:string;endpoint:string;protocolVersion:string;server:Record<string,unknown>;capabilities:Record<string,unknown>;tools:{name:string;description?:string;inputSchema:Record<string,unknown>;annotations?:Record<string,unknown>}[];sha256:string}
export interface McpClientOptions {endpointId:string;endpoint:string;credentialRef:string;credentials:(ref:string)=>Promise<string|undefined>;timeoutMs?:number;expectedSnapshotHash?:string}
export class McpToolClient {
 readonly endpoint:URL;readonly timeoutMs:number;#client:Client|undefined;#transport:TrackingTransport|undefined;#snapshot:ConnectionSnapshot|undefined;
 constructor(readonly options:McpClientOptions){const url=new URL(options.endpoint);if(url.username||url.password||url.hash||url.search||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['127.0.0.1','[::1]','localhost'].includes(url.hostname))throw new ToolError('MCP_ENDPOINT_INVALID','not-sent');this.endpoint=url;this.timeoutMs=options.timeoutMs??10000;if(!Number.isInteger(this.timeoutMs)||this.timeoutMs<10||this.timeoutMs>30000)throw new ToolError('MCP_TIMEOUT_INVALID','not-sent');}
 get snapshot(){if(!this.#snapshot)throw new ToolError('MCP_NOT_CONNECTED','not-sent');return this.#snapshot;}
 connect(){return this.connectAttempt(0);}
 private async connectAttempt(attempt:number):Promise<ConnectionSnapshot>{
  await this.close();let secret:string|undefined;try{secret=await this.options.credentials(this.options.credentialRef);}catch{throw new ToolError('MCP_AUTH_UNAVAILABLE','not-sent');}if(!secret||secret.length<16)throw new ToolError('MCP_NOT_CONFIGURED','not-sent');
  const fetchBound:typeof fetch=async(input,init)=>{
   const url=new URL(input instanceof Request?input.url:String(input));if(url.href!==this.endpoint.href)throw new ToolError('MCP_ENDPOINT_CHANGED','not-sent');
   const response=await fetch(input,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),Authorization:'Bearer '+secret},redirect:'error',signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(this.timeoutMs)]):AbortSignal.timeout(this.timeoutMs)});
   if(!response.body)return response;const chunks:Uint8Array[]=[];let bytes=0;const reader=response.body.getReader();try{for(;;){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>1024*1024)throw new ToolError('MCP_RESPONSE_TOO_LARGE','unknown');chunks.push(r.value);}}finally{await reader.cancel();}
   return new Response(Buffer.concat(chunks),{status:response.status,headers:response.headers});
  };
  const transport=new TrackingTransport(this.endpoint,{fetch:fetchBound,reconnectionOptions:{maxReconnectionDelay:0,initialReconnectionDelay:0,reconnectionDelayGrowFactor:1,maxRetries:0}}),client=new Client({name:'devmesh-agent-runtime',version:'0.1.0'});
  try{await client.connect(transport,{timeout:this.timeoutMs});const listed=await client.listTools({}, {timeout:this.timeoutMs});if(listed.nextCursor)throw new ToolError('MCP_TOOL_CATALOG_TOO_LARGE','not-sent');
   const tools=listed.tools.map(t=>({name:t.name,...(t.description?{description:t.description}:{}),inputSchema:t.inputSchema as Record<string,unknown>,...(t.annotations?{annotations:t.annotations as Record<string,unknown>}:{})})).sort((a,b)=>a.name.localeCompare(b.name));
   const basis={endpointId:this.options.endpointId,endpoint:this.endpoint.href,protocolVersion:transport.negotiated,server:client.getServerVersion() as Record<string,unknown>,capabilities:client.getServerCapabilities() as Record<string,unknown>,tools};const sha256=hash(basis);
   if(!transport.negotiated||this.options.expectedSnapshotHash&&sha256!==this.options.expectedSnapshotHash||this.#snapshot&&sha256!==this.#snapshot.sha256)throw new ToolError('MCP_SCHEMA_CHANGED','not-sent');
   const snapshot={...basis,sha256};freeze(snapshot);this.#snapshot=snapshot;this.#client=client;this.#transport=transport;return snapshot;
  }catch(error){await client.close();if(error instanceof ToolError)throw error;
   // Initialization and catalog reads have no business side effects. A stale
   // keepalive socket after a server restart may be retried once at this stage.
   // callTool is deliberately outside this retry boundary.
   if(attempt===0)return this.connectAttempt(1);throw new ToolError('MCP_CONNECT_FAILED','not-sent');}
 }
 async call(name:string,operationId:string,permit:z.output<typeof executionPermit>,args:unknown,signal?:AbortSignal){
  const client=this.#client;if(!client||!this.snapshot.tools.some(t=>t.name===name))throw new ToolError('MCP_TOOL_UNAVAILABLE','not-sent');
  try{const result=await client.callTool({name,arguments:{operationId,permit:executionPermit.parse(permit),args}},undefined,{timeout:this.timeoutMs,...(signal?{signal}:{})});
   const text=z.array(z.object({type:z.string(),text:z.string().optional()})).catch([]).parse(result.content).find(c=>c.type==='text')?.text,parsed=toolResult.safeParse(result.structuredContent??(text?JSON.parse(text):undefined));
   if(!parsed.success||parsed.data.operationId!==operationId||parsed.data.tool!==name)throw new ToolError('MCP_RESULT_INVALID','unknown');if(parsed.data.state==='FAILED')throw new ToolError(parsed.data.error.code,parsed.data.error.outcome);return parsed.data.value;
  }catch(error){if(error instanceof ToolError)throw error;throw new ToolError('MCP_CALL_UNKNOWN','unknown');}
 }
 async close(){const client=this.#client,transport=this.#transport;this.#client=undefined;this.#transport=undefined;if(client)await client.close();else if(transport)await transport.close();}
}
