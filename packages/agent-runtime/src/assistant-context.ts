import type {AssistantToolRecord} from '@devmesh/storage-sqlite';

export function boundedText(value:string,bytes:number){let low=0,high=value.length;while(low<high){const middle=Math.ceil((low+high)/2);if(Buffer.byteLength(value.slice(0,middle),'utf8')<=bytes)low=middle;else high=middle-1;}const text=value.slice(0,low);return /[\ud800-\udbff]$/.test(text)?text.slice(0,-1):text;}
/** Full results remain durable. Bound display context without changing tool effects or verdicts. */
export function modelToolResult(tool:AssistantToolRecord,limit=7000):Record<string,unknown>{
 const source=tool.result??{state:tool.state};if(Buffer.byteLength(JSON.stringify(source))<=limit)return source;
 const result:Record<string,unknown>={...source,truncated:true};
 if(typeof result.text==='string'){const text=boundedText(result.text,Math.max(0,(limit-1500)/2));result.text=text;result.nextOffset=Number(tool.args.offset??0)+text.length;}
 if(typeof result.output==='string'){const output=result.output;result.output=boundedText(output,Math.max(0,(limit-1800)/5))+'\n…输出已截断，完整日志已保存…\n'+output.slice(-Math.max(0,Math.floor((limit-1800)/5)));}
 if(Array.isArray(result.changes)){const changes=result.changes as Record<string,unknown>[];result.totalChanges=changes.length;result.changes=changes.map(c=>({path:c.path,beforeSha256:c.beforeSha256,afterSha256:c.afterSha256,added:c.added,removed:c.removed,diffExcerpt:typeof c.diff==='string'?boundedText(c.diff,Math.floor(Math.max(0,limit-1500)/Math.max(1,changes.length)*.5)):''}));}
 if(Array.isArray(result.files)){const files=[...result.files];while(files.length&&Buffer.byteLength(JSON.stringify({...result,files}))>limit)files.pop();result.files=files;if(files.length<(source.files as unknown[]).length)result.nextOffset=Number(tool.args.offset??0)+files.length;}
 if(Array.isArray(result.matches)){const matches=[...result.matches];while(matches.length&&Buffer.byteLength(JSON.stringify({...result,matches}))>limit)matches.pop();result.matches=matches;result.limited=true;}
 if(Buffer.byteLength(JSON.stringify(result))<=limit)return result;
 if(Array.isArray(result.changes)){const changes=[...result.changes];while(changes.length&&Buffer.byteLength(JSON.stringify({...result,changes}))>limit)changes.pop();result.changes=changes;}
 if(Buffer.byteLength(JSON.stringify(result))<=limit)return result;
 return {state:source.state??tool.state,exitCode:source.exitCode??null,sha256:source.sha256??null,truncated:true,note:'结果已完整保存；请缩小读取或搜索范围。读取页未完整展示时可按原 offset 重新读取。',nextOffset:tool.args.offset??null};
}
