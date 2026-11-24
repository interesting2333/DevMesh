import {Script} from 'node:vm';

/** Basic HTML structure, self-contained resources and inline JS syntax; never execute user code. */
export function checkStaticHtml(files:{path:string;text:string}[]){
 const errors:string[]=[],notes:string[]=[];if(!files.length)errors.push('没有可检查的 HTML 文件。');
 for(const file of files){
  const text=file.text.replace(/<!--[\s\S]*?-->/g,''),markup=text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  if(!/<!doctype\s+html\s*>/i.test(markup))errors.push(file.path+'：缺少 HTML5 doctype。');
  for(const tag of ['html','head','title','body'])if(!new RegExp('<'+tag+'(?:\\s[^>]*)?>[\\s\\S]*?</'+tag+'\\s*>','i').test(markup))errors.push(file.path+'：需要完整的 '+tag+' 标签。');
  if(/<base\b|<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i.test(markup))errors.push(file.path+'：预览不支持 base 或自动跳转。');
  if(/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel\s*=\s*["']?stylesheet/i.test(text))errors.push(file.path+'：请将 CSS 和 JavaScript 内联，生成可独立打开的 HTML。');
  if((text.match(/<script\b/gi)??[]).length!==(text.match(/<\/script\s*>/gi)??[]).length)errors.push(file.path+'：script 标签未正确关闭。');
  let index=0;for(const script of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){index++;const attrs=script[1]??'',body=script[2]??'';if(/\btype\s*=\s*["']?(?:application\/ld\+json|application\/json|importmap)/i.test(attrs))continue;if(/\btype\s*=\s*["']?module/i.test(attrs)){errors.push(file.path+'：请使用内联普通脚本，当前静态检查不支持模块导入。');continue;}try{new Script(body,{filename:file.path+':script'+index});}catch(e){errors.push(file.path+'：内联脚本 '+index+' 语法错误：'+(e instanceof Error?e.message:'invalid syntax'));}}
  notes.push(file.path+'：已检查基础结构与内联脚本语法。');
 }
 return {state:errors.length?'FAILED':'SUCCEEDED',exitCode:errors.length?1:0,output:[...notes,...errors,...(!errors.length?['HTML 基础检查通过；交互效果可在隔离预览中查看。']:[])].join('\n').slice(-65536)};
}
