/** Platform record projection; project source/build bytes are not rewritten. */
export function redactExportRecord(value:unknown,depth=0):unknown{
 if(depth>40)throw new Error('EXPORT_RECORD_DEPTH');
 if(typeof value==='string'){
  // Tool arguments sometimes contain a second serialized JSON object. Apply
  // the same field projection there without evaluating code or parsing prose.
  if(/^\s*[{[]/.test(value)){let parsed:unknown;try{parsed=JSON.parse(value);}catch{/* Ordinary prose remains a string. */}if(parsed&&typeof parsed==='object')return JSON.stringify(redactExportRecord(parsed,depth+1));}
  return value.replace(/-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----[\s\S]*?-----END (?:[A-Z ]*PRIVATE KEY)-----/g,'[REDACTED]').replace(/\bBearer\s+[^\s"'<>]+/gi,'Bearer [REDACTED]').replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g,'[REDACTED]');
 }
 if(Array.isArray(value))return value.map(v=>redactExportRecord(v,depth+1));
 if(value&&typeof value==='object'){
  const out:Record<string,unknown>={};for(const [key,v] of Object.entries(value)){
   if(/authorization|cookie|password|secret|credential|api.?key|access.?token|refresh.?token|claim.?token|ticket|permit|reasoning|thinking|chain.?of.?thought|private.?key/i.test(key))continue;
   Object.defineProperty(out,key,{value:redactExportRecord(v,depth+1),enumerable:true,configurable:true,writable:true});
  }return out;
 }return value;
}
