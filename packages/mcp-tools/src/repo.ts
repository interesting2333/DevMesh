import { constants } from 'node:fs';
import { lstat,open,realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalRoot } from '@devmesh/blob-store';
import { relativeFile,opaqueKey,sha256 } from '@devmesh/contracts';
import { ToolError } from './protocol.js';
import type { ToolDefinition } from './protocol.js';
const snapshotSchema=z.strictObject({snapshotRef:opaqueKey,resourceId:opaqueKey,root:z.string().min(1),files:z.array(z.strictObject({path:relativeFile,sha256,byteSize:z.number().int().min(0).max(65536)})).max(2000)});
export type RepoSnapshot=z.output<typeof snapshotSchema>;
export const repoListArgs=z.strictObject({snapshotRef:opaqueKey,prefix:z.string().max(512).default(''),limit:z.number().int().min(1).max(200).default(100)});
export const repoReadArgs=z.strictObject({snapshotRef:opaqueKey,path:relativeFile});
const denied=(path:string)=>path.split('/').some(v=>v.startsWith('.')||['node_modules','vendor','secrets'].includes(v)||/\.(pem|key|p12|pfx)$/i.test(v));
export function repoTools(input:readonly RepoSnapshot[]):ToolDefinition[]{
 const snapshots=input.map(v=>snapshotSchema.parse(structuredClone(v)));if(new Set(snapshots.map(s=>s.snapshotRef)).size!==snapshots.length)throw new ToolError('MCP_SNAPSHOT_CONFIGURATION_INVALID','not-sent');
 for(const s of snapshots)if(new Set(s.files.map(f=>f.path)).size!==s.files.length||s.files.some(f=>denied(f.path)))throw new ToolError('MCP_SNAPSHOT_CONFIGURATION_INVALID','not-sent');
 const get=(ref:string,permit:Parameters<ToolDefinition['execute']>[0]['permit'])=>{const s=snapshots.find(s=>s.snapshotRef===ref);if(!s||!permit.resources.some(r=>r.kind==='snapshot'&&r.resourceId===s.resourceId))throw new ToolError('MCP_SNAPSHOT_DENIED','not-sent');return s;};
 return [
  {name:'repo.list',description:'List the authorized immutable repository snapshot manifest',schema:repoListArgs,action:'read',effectClass:'READ',async execute({args,permit}){const a=repoListArgs.parse(args),s=get(a.snapshotRef,permit);if(a.prefix&&(a.prefix.startsWith('/')||a.prefix.includes('\\')||a.prefix.split('/').some(p=>p==='..'||p==='.')))throw new ToolError('MCP_PATH_DENIED','not-sent');const matches=s.files.filter(f=>f.path.startsWith(a.prefix)).sort((a,b)=>a.path.localeCompare(b.path));return {snapshotRef:s.snapshotRef,files:matches.slice(0,a.limit),truncated:matches.length>a.limit};}},
  {name:'repo.read',description:'Read and verify one authorized snapshot file without executing code',schema:repoReadArgs,action:'read',effectClass:'READ',async execute({args,permit}){
   const a=repoReadArgs.parse(args),s=get(a.snapshotRef,permit),entry=s.files.find(f=>f.path===a.path);if(!entry||denied(a.path))throw new ToolError('MCP_PATH_DENIED','not-sent');canonicalRoot(s.root);const root=await realpath(s.root),parts=a.path.split('/');let path=root;
   for(const part of parts.slice(0,-1)){path=join(path,part);const stat=await lstat(path);if(stat.isSymbolicLink()||!stat.isDirectory())throw new ToolError('MCP_PATH_DENIED','not-sent');}
   path=join(path,parts.at(-1)!);const before=await lstat(path);if(before.isSymbolicLink()||!before.isFile()||before.nlink!==1||before.size!==entry.byteSize)throw new ToolError('MCP_SNAPSHOT_CHANGED','not-sent');
   const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);let bytes:Buffer;try{const st=await file.stat();if(!st.isFile()||st.nlink!==1||st.ino!==before.ino||st.dev!==before.dev||st.size!==entry.byteSize)throw new ToolError('MCP_SNAPSHOT_CHANGED','not-sent');bytes=Buffer.alloc(st.size);let pos=0;while(pos<bytes.length){const r=await file.read(bytes,pos,bytes.length-pos,pos);if(!r.bytesRead)throw new ToolError('MCP_SNAPSHOT_CHANGED','not-sent');pos+=r.bytesRead;}}finally{await file.close();}
   if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new ToolError('MCP_SNAPSHOT_CHANGED','not-sent');let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new ToolError('MCP_BINARY_FILE_UNSUPPORTED','not-sent');}return {snapshotRef:s.snapshotRef,path:entry.path,sha256:entry.sha256,byteSize:entry.byteSize,text};
  }},
 ];
}
