import { z } from 'zod';
import { executionPermit,ids,opaqueKey } from '@devmesh/contracts';
export class ToolError extends Error {constructor(readonly code:string,readonly outcome:'not-sent'|'known'|'unknown'='known'){super(code);}}
export type ToolAction='read'|'write'|'stop';
export interface ToolAuthority {authorize(controllerId:string,tool:string,permit:z.output<typeof executionPermit>,action:ToolAction):Promise<void>}
export interface ToolDefinition {name:string;description:string;schema:z.ZodObject;action:ToolAction;effectClass:'READ'|'IDEMPOTENT_WRITE'|'NONIDEMPOTENT_WRITE';execute(input:{controllerId:string;operationId:string;permit:z.output<typeof executionPermit>;args:Record<string,unknown>;signal:AbortSignal}):Promise<unknown>}
export const toolEnvelope=(schema:z.ZodObject)=>z.strictObject({operationId:ids.operation,permit:executionPermit,args:schema});
export const toolResult=z.discriminatedUnion('state',[
 z.strictObject({schemaVersion:z.literal('devmesh.mcp-tool-result.v1'),source:z.literal('mcp'),tool:opaqueKey,operationId:ids.operation,state:z.literal('SUCCEEDED'),value:z.json()}),
 z.strictObject({schemaVersion:z.literal('devmesh.mcp-tool-result.v1'),source:z.literal('mcp'),tool:opaqueKey,operationId:ids.operation,state:z.literal('FAILED'),error:z.strictObject({code:opaqueKey,outcome:z.enum(['not-sent','known','unknown'])})}),
]);
