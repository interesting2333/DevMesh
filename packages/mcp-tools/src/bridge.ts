import { z } from 'zod';
import { executionPermit } from '@devmesh/contracts';
import { canonical } from '@devmesh/storage-sqlite';
import type { RuntimeTool,ToolResult } from '@devmesh/agent-runtime';
import { McpToolClient } from './client.js';
import { ToolError,toolEnvelope } from './protocol.js';
import type { ToolDefinition } from './protocol.js';
const stripSchema=(value:unknown):unknown=>{if(Array.isArray(value))return value.map(stripSchema);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='$schema').map(([k,v])=>[k,stripSchema(v)]));return value;};
export function runtimeMcpTools(client:McpToolClient,contracts:readonly Pick<ToolDefinition,'name'|'description'|'schema'|'effectClass'>[]):RuntimeTool[]{
 const snapshot=client.snapshot;
 const modelNames=contracts.map(t=>t.name.replaceAll('.','_'));if(new Set(modelNames).size!==modelNames.length||modelNames.some(n=>!/^[A-Za-z0-9_-]{1,128}$/.test(n)))throw new ToolError('MCP_MODEL_TOOL_NAME_INVALID','not-sent');
 return contracts.map(contract=>{
  const advertised=snapshot.tools.find(t=>t.name===contract.name);
  if(!advertised||canonical(stripSchema(advertised.inputSchema))!==canonical(stripSchema(z.toJSONSchema(toolEnvelope(contract.schema),{target:'draft-7',io:'input'}))))throw new ToolError('MCP_SCHEMA_CHANGED','not-sent');
  if(advertised.annotations?.readOnlyHint!==(contract.effectClass==='READ')||advertised.annotations?.idempotentHint!==(contract.effectClass!=='NONIDEMPOTENT_WRITE'))throw new ToolError('MCP_EFFECT_POLICY_CHANGED','not-sent');
  const call=async(name:string,op:string,host:Parameters<RuntimeTool['query']>[1],args:unknown,signal?:AbortSignal):Promise<ToolResult>=>{if(client.snapshot.sha256!==snapshot.sha256)throw new ToolError('MCP_SCHEMA_CHANGED','not-sent');try{return {state:'SUCCEEDED',value:{source:'mcp',connectionHash:snapshot.sha256,result:await client.call(name,op,executionPermit.parse(host.permit),args,signal)}};}catch(error){return error instanceof ToolError&&error.outcome!=='unknown'?{state:'FAILED',value:{source:'mcp',code:error.code}}:{state:'OUTCOME_UNKNOWN'};}};
  return {name:contract.name.replaceAll('.','_'),description:contract.description,schema:contract.schema,effectClass:contract.effectClass,connection:{source:'mcp',toolName:contract.name,snapshot:z.record(z.string(),z.json()).parse(snapshot)},
   execute:(op,args,host,signal)=>call(contract.name,op,host,contract.schema.parse(args),signal),
   async query(op,host,args){
    if(contract.name==='tests.start'){const result=await call('tests.by-operation',op,host,{operationId:op});return result.state==='FAILED'?{state:'OUTCOME_UNKNOWN'}:result;}
    if((contract.name==='tests.stop'||contract.name==='tests.get')&&args){const parsed=z.strictObject({jobId:z.string()}).safeParse(args);if(!parsed.success)return {state:'OUTCOME_UNKNOWN'};const result=await call('tests.get',op,host,{jobId:parsed.data.jobId});if(contract.name==='tests.stop'&&result.state==='SUCCEEDED'){const value=result.value as {result:{stopRequested?:boolean}};if(!value.result.stopRequested)return {state:'OUTCOME_UNKNOWN'};}return result;}
    // Read failures can be retried as a new authorized read, but this reconciler
    // does not invent a result or repeat the original mutation.
    return {state:'OUTCOME_UNKNOWN'};
   },
  };
 });
}
