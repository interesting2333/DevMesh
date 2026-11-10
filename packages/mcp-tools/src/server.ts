import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { RequestHandler,ErrorRequestHandler } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { canonical } from '@devmesh/storage-sqlite';
import { opaqueKey } from '@devmesh/contracts';
import { RunnerError } from '@devmesh/runner';
import { ToolError,toolEnvelope } from './protocol.js';
import type { ToolAuthority,ToolDefinition } from './protocol.js';
export interface McpServiceOptions {serviceId:string;version:string;host?:'127.0.0.1'|'::1';port?:number;identities:{controllerId:string;credentialRef:string;allowedTools:readonly string[]}[];credentials:(ref:string)=>Promise<string|undefined>;authority:ToolAuthority;tools:readonly ToolDefinition[]}
export async function serveMcp(options:McpServiceOptions){
 opaqueKey.parse(options.serviceId);const names=options.tools.map(t=>t.name);if(new Set(names).size!==names.length||new Set(options.identities.map(i=>i.controllerId)).size!==options.identities.length||new Set(options.identities.map(i=>i.credentialRef)).size!==options.identities.length)throw new ToolError('MCP_CONFIGURATION_INVALID','not-sent');for(const name of names)opaqueKey.parse(name);
 const app=express(),host=options.host??'127.0.0.1';if(!['127.0.0.1','::1'].includes(host))throw new ToolError('MCP_BIND_INVALID','not-sent');app.disable('x-powered-by');app.disable('etag');
 const instances=new Set<McpServer>();let closing=false;
 const auth:RequestHandler=async(req,res,next)=>{try{
  // This service has no browser-origin API. A local malicious page must not call it.
  if(req.headers.origin!==undefined||!/^(127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(req.headers.host??'')){res.status(403).json({error:'MCP_ORIGIN_DENIED'});return;}
  const raw=req.headers.authorization,presented=Buffer.from(raw?.startsWith('Bearer ')?raw.slice(7):'');if(presented.length<16||presented.length>4096){res.status(401).json({error:'MCP_AUTH_REQUIRED'});return;}
  const matches=[];for(const identity of options.identities){const secret=await options.credentials(identity.credentialRef);if(!secret||secret.length<16)continue;const expected=Buffer.from(secret);if(expected.length===presented.length&&timingSafeEqual(expected,presented))matches.push(identity);}if(matches.length!==1){res.status(401).json({error:'MCP_AUTH_REQUIRED'});return;}res.locals.identity=matches[0];next();
 }catch{res.status(503).json({error:'MCP_AUTH_UNAVAILABLE'});}};
 app.use('/mcp',auth,express.json({limit:'256kb',strict:true}));
 app.post('/mcp',async(req,res)=>{
  if(closing){res.status(503).json({error:'MCP_STOPPING'});return;}
  const identity=res.locals.identity as McpServiceOptions['identities'][number],server=new McpServer({name:options.serviceId,version:options.version},{maxToolInputElements:4096});instances.add(server);
  for(const def of options.tools.filter(t=>identity.allowedTools.includes(t.name))){server.registerTool(def.name,{description:def.description,inputSchema:toolEnvelope(def.schema),annotations:{readOnlyHint:def.effectClass==='READ',idempotentHint:def.effectClass!=='NONIDEMPOTENT_WRITE',destructiveHint:def.action==='write',openWorldHint:false}},async(input,extra)=>{
    const base={schemaVersion:'devmesh.mcp-tool-result.v1' as const,source:'mcp' as const,tool:def.name,operationId:input.operationId};
    try{await options.authority.authorize(identity.controllerId,def.name,input.permit,def.action);}catch{const body={...base,state:'FAILED',error:{code:'MCP_AUTHORITY_DENIED',outcome:'not-sent'}};return {isError:true,content:[{type:'text' as const,text:canonical(body)}],structuredContent:body};}
    try{const value=await def.execute({controllerId:identity.controllerId,operationId:input.operationId,permit:input.permit,args:def.schema.parse(input.args),signal:extra.signal}),body={...base,state:'SUCCEEDED',value};return {content:[{type:'text' as const,text:canonical(body)}],structuredContent:body};}
    catch(error){const body={...base,state:'FAILED',error:{code:error instanceof ToolError||error instanceof RunnerError?error.code:'MCP_TOOL_FAILED',outcome:error instanceof ToolError||error instanceof RunnerError?error.outcome:'unknown'}};return {isError:true,content:[{type:'text' as const,text:canonical(body)}],structuredContent:body};}
  });}
  const transport=new StreamableHTTPServerTransport({enableJsonResponse:true});
  res.once('close',()=>{instances.delete(server);void server.close().catch(()=>{});});
  try{await server.connect(transport);await transport.handleRequest(req,res,req.body);}catch{if(!res.headersSent)res.status(500).json({jsonrpc:'2.0',id:null,error:{code:-32603,message:'MCP_REQUEST_FAILED'}});}
 });
 app.all('/mcp',(_req,res)=>{res.status(405).json({jsonrpc:'2.0',id:null,error:{code:-32000,message:'METHOD_NOT_ALLOWED'}});});
 const errors:ErrorRequestHandler=(error,_req,res,_next)=>{res.status(error?.type==='entity.too.large'?413:422).json({error:'MCP_REQUEST_INVALID'});};app.use(errors);
 const server=createServer({headersTimeout:5000,requestTimeout:10000},app);await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port??0,host,()=>{server.off('error',reject);resolve();});});let closed:Promise<void>|undefined;
 return {address:server.address() as AddressInfo,endpoint:'http://'+(host==='::1'?'[::1]':host)+':'+(server.address() as AddressInfo).port+'/mcp',close(){return closed??=(async()=>{closing=true;const done=new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));server.closeAllConnections();await Promise.allSettled([...instances].map(s=>s.close()));await done;})();}};
}
