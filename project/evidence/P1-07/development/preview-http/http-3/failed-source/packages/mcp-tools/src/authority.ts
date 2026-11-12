import type {SqliteStorage} from '@devmesh/storage-sqlite';
import type {ToolAuthority} from './protocol.js';
import {ToolError} from './protocol.js';

/** Deployment-owned controllers; model arguments cannot add a controller or a tool. */
export function workflowToolAuthority(storage:SqliteStorage,controllers:ReadonlyMap<string,ReadonlySet<string>>):ToolAuthority{
  const frozen=new Map([...controllers].map(([id,tools])=>[id,new Set(tools)]));
  return {async authorize(controllerId,toolName,permit,action){
    if(!frozen.get(controllerId)?.has(toolName))throw new ToolError('MCP_AUTHORITY_DENIED','not-sent');
    await storage.request('authorizeMcpAction',{permit,toolName,action});
  }};
}
