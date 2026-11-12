import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import type {LocalContentStore} from '@devmesh/blob-store';
import {ToolError} from './protocol.js';
import type {ToolDefinition} from './protocol.js';

const source=z.discriminatedUnion('kind',[
  z.strictObject({kind:z.literal('artifact'),artifactId:ids.artifact}),
  z.strictObject({kind:z.literal('attachment'),attachmentId:ids.attachment}),
]);
const binding=z.strictObject({documentRef:opaqueKey,version:opaqueKey,resourceId:opaqueKey,runId:ids.run,
  principalId:opaqueKey,reference:source,sha256,byteSize:z.number().int().nonnegative().max(2*1024*1024)});
export type DocumentBinding=z.output<typeof binding>;
const documentVersion=z.strictObject({documentRef:opaqueKey,version:opaqueKey});
export const docsReadArgs=documentVersion.extend({startOffset:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(8192).default(4096)});
export const docsSearchArgs=z.strictObject({documents:z.array(documentVersion).min(1).max(32),query:z.string().min(1).max(256),limit:z.number().int().min(1).max(40).default(20)});
const denied=()=>new ToolError('MCP_DOCUMENT_DENIED','not-sent');
const low=(s:string,n:number)=>n<s.length&&s.charCodeAt(n)>=0xdc00&&s.charCodeAt(n)<=0xdfff;

export function docsTools(content:LocalContentStore,input:readonly DocumentBinding[]):ToolDefinition[]{
  const documents=z.array(binding).max(128).parse(structuredClone(input));
  const keys=documents.map(d=>d.documentRef+'\0'+d.version);
  if(new Set(keys).size!==keys.length||documents.reduce((n,d)=>n+d.byteSize,0)>16*1024*1024)
    throw new ToolError('MCP_DOCUMENT_CONFIGURATION_INVALID','not-sent');
  function resolve(ref:z.output<typeof documentVersion>,permit:Parameters<ToolDefinition['execute']>[0]['permit']){
    const d=documents.find(d=>d.documentRef===ref.documentRef&&d.version===ref.version);
    if(!d||permit.ownerKind!=='workflowAttempt'||permit.runId!==d.runId||!permit.resources.some(r=>r.kind==='dataset'&&r.resourceId===d.resourceId))throw denied();
    return d;
  }
  async function read(d:DocumentBinding,signal:AbortSignal){
    signal.throwIfAborted();
    const bytes=await content.readBytes(d.principalId,d.reference,2*1024*1024);
    if(bytes.byteLength!==d.byteSize||createHash('sha256').update(bytes).digest('hex')!==d.sha256)throw new ToolError('MCP_DOCUMENT_CHANGED','not-sent');
    signal.throwIfAborted();
    try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new ToolError('MCP_DOCUMENT_ENCODING_INVALID','not-sent');}
  }
  const provenance=(d:DocumentBinding)=>({documentRef:d.documentRef,version:d.version,sha256:d.sha256,reference:d.reference,offsetUnit:'utf16-code-unit' as const});
  function* paragraphs(text:string){
    let start=0,paragraph=0;
    for(const match of text.matchAll(/\r?\n[\t ]*\r?\n/g)){
      const end=match.index;if(end>start)yield {paragraph:++paragraph,startOffset:start,endOffset:end};start=end+match[0].length;
    }
    if(start<text.length)yield {paragraph:++paragraph,startOffset:start,endOffset:text.length};
  }
  return [
    {name:'docs.read',description:'Read a bounded range from a fixed authorized document; offsets count UTF-16 code units',schema:docsReadArgs,action:'read',effectClass:'READ',async execute({args,permit,signal}){
      const a=docsReadArgs.parse(args),d=resolve(a,permit),text=await read(d,signal),start=a.startOffset;
      if(start>text.length||low(text,start))throw new ToolError('MCP_DOCUMENT_OFFSET_INVALID','not-sent');
      let end=Math.min(text.length,start+a.limit);if(low(text,end))end--;
      if(end===start&&start<text.length)throw new ToolError('MCP_DOCUMENT_RANGE_TOO_SMALL','not-sent');
      const visible=[];for(const p of paragraphs(text)){if(p.startOffset>=end)break;if(p.endOffset>start)visible.push(p);if(visible.length===100)break;}
      return {...provenance(d),startOffset:start,endOffset:end,totalLength:text.length,text:text.slice(start,end),
        paragraphs:visible,truncated:end<text.length};
    }},
    {name:'docs.search',description:'Find literal keyword matches in fixed authorized sources, preserving exact original offsets',schema:docsSearchArgs,action:'read',effectClass:'READ',async execute({args,permit,signal}){
      const a=docsSearchArgs.parse(args);
      if(new Set(a.documents.map(d=>d.documentRef+'\0'+d.version)).size!==a.documents.length)throw new ToolError('MCP_DOCUMENT_QUERY_INVALID','not-sent');
      // Resolve all sources before reading any; a mixed authorized/unauthorized query never returns a partial disclosure.
      const selected=a.documents.map(ref=>resolve(ref,permit)),matches:Record<string,unknown>[]=[];
      for(const d of selected){
        const text=await read(d,signal);let from=0;
        while(from<=text.length){
          const index=text.indexOf(a.query,from);if(index<0)break;
          if(matches.length===a.limit)return {matches,truncated:true};
          let start=Math.max(0,index-80),end=Math.min(text.length,index+a.query.length+80);
          if(low(text,start))start--;if(low(text,end))end++;
          let paragraph:number|null=null;for(const p of paragraphs(text)){if(p.startOffset>index)break;if(p.endOffset>index){paragraph=p.paragraph;break;}}
          matches.push({...provenance(d),startOffset:index,endOffset:index+a.query.length,paragraph,
            excerpt:{startOffset:start,endOffset:end,text:text.slice(start,end)}});
          from=index+a.query.length;
        }
      }
      return {matches,truncated:false};
    }},
  ];
}
