import {z} from 'zod';

const finish=z.enum(['stop','tool_calls','length','content_filter','insufficient_system_resource']);
const part=z.object({index:z.number().int().min(0).max(127),id:z.string().min(1).max(256).optional(),type:z.literal('function').optional(),function:z.object({name:z.string().max(128).optional(),arguments:z.string().max(1024*1024).optional()}).optional()});
const chunk=z.object({id:z.string().min(1).max(512),model:z.string().min(1),choices:z.array(z.object({index:z.literal(0),delta:z.object({role:z.literal('assistant').optional(),content:z.string().nullable().optional(),reasoning_content:z.string().nullable().optional(),tool_calls:z.array(part).max(128).nullable().optional(),server_tool_calls:z.array(z.unknown()).optional()}),finish_reason:finish.nullable()})).max(1),usage:z.object({prompt_tokens:z.number().int().safe().nonnegative(),completion_tokens:z.number().int().safe().nonnegative()}).nullable().optional()});
type Tool={id:string;type:'function';function:{name:string;arguments:string}};

/** Collect the complete provider response; callbacks are display-only, never tool admission. */
export async function readDeepSeekStream(body:ReadableStream<Uint8Array>,maximumBytes:number,expectedModel:string,onDelta:((text:string)=>void)|undefined,invalid:(code:string)=>never){
 const reader=body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true}),tools=new Map<number,Tool>();
 let pending='',data:string[]=[],bytes=0,id:string|undefined,model:string|undefined,content='',finished:z.output<typeof finish>|undefined,done=false,usage:z.output<typeof chunk>['usage'];
 function dispatch(){
  if(!data.length)return;const value=data.join('\n');data=[];
  if(value==='[DONE]'){if(!finished||!id||!model)invalid('MODEL_STREAM_INCOMPLETE');done=true;return;}
  let raw:unknown;try{raw=JSON.parse(value);}catch{invalid('MODEL_RESPONSE_INVALID');}
  const parsed=chunk.safeParse(raw);if(!parsed.success)invalid('MODEL_RESPONSE_INVALID');const c=parsed.data;
  if(c.model!==expectedModel)invalid('MODEL_ID_MISMATCH');
  if(id!==undefined&&(c.id!==id||c.model!==model))invalid('MODEL_STREAM_ID_MISMATCH');id=c.id;model=c.model;
  if(c.usage){if(usage&&(usage.prompt_tokens!==c.usage.prompt_tokens||usage.completion_tokens!==c.usage.completion_tokens))invalid('MODEL_STREAM_USAGE_INVALID');usage=c.usage;}
  const choice=c.choices[0];if(!choice){if(!finished||!c.usage)invalid('MODEL_RESPONSE_INVALID');return;}
  const d=choice.delta;if(d.reasoning_content||d.server_tool_calls?.length)invalid('MODEL_STREAM_UNSUPPORTED_DELTA');
  if(finished&&(d.content||d.tool_calls?.length||choice.finish_reason!==null&&choice.finish_reason!==finished))invalid('MODEL_STREAM_AFTER_FINISH');
  if(d.content){content+=d.content;try{onDelta?.(d.content);}catch{/* Display observers cannot change model outcomes. */}}
  for(const piece of d.tool_calls??[]){
   let tool=tools.get(piece.index);
   if(!tool){if(piece.index!==tools.size||!piece.id||piece.type!=='function')invalid('MODEL_TOOL_CALLS_INVALID');tool={id:piece.id,type:'function',function:{name:'',arguments:''}};tools.set(piece.index,tool);}
   else if(piece.id!==undefined&&piece.id!==tool.id)invalid('MODEL_TOOL_CALLS_INVALID');
   tool.function.name+=piece.function?.name??'';tool.function.arguments+=piece.function?.arguments??'';
   if(tool.function.name.length>128||tool.function.arguments.length>1024*1024)invalid('MODEL_RESPONSE_TOO_LARGE');
  }
  if(choice.finish_reason!==null)finished=choice.finish_reason;
 }
 function line(value:string){if(value===''){dispatch();return;}if(value.startsWith(':'))return;const colon=value.indexOf(':'),field=colon<0?value:value.slice(0,colon);if(field==='data'){const text=colon<0?'':value.slice(colon+1);data.push(text.startsWith(' ')?text.slice(1):text);}}
 function consume(eof=false){
  while(!done){const at=pending.search(/[\r\n]/);if(at<0)break;if(pending[at]==='\r'&&at===pending.length-1&&!eof)break;const width=pending[at]==='\r'&&pending[at+1]==='\n'?2:1,value=pending.slice(0,at);pending=pending.slice(at+width);line(value);}
  if(eof&&!done){if(pending){line(pending);pending='';}dispatch();}
 }
 function decode(value?:Uint8Array,stream=false){try{return decoder.decode(value,{stream});}catch{invalid('MODEL_RESPONSE_INVALID');}}
 try{
  for(;;){const next=await reader.read();if(next.done){pending+=decode();consume(true);break;}bytes+=next.value.byteLength;if(bytes>maximumBytes)invalid('MODEL_RESPONSE_TOO_LARGE');pending+=decode(next.value,true);consume();if(done)break;}
  if(!done||!finished||!id||!model)invalid('MODEL_STREAM_INCOMPLETE');
  return {id,model,choices:[{index:0,finish_reason:finished,message:{role:'assistant',content,tool_calls:[...tools.values()]}}],...(usage?{usage}:{})};
 }finally{await reader.cancel().catch(()=>{});}
}
