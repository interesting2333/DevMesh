import {qualityLimits} from '@devmesh/contracts';

export class VerificationError extends Error {
  constructor(readonly code:string){super(code);this.name='VerificationError';}
}
export function reject(code:string):never{throw new VerificationError(code);}
export function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))return reject('REPORT_OBJECT_REQUIRED');return value as Record<string,unknown>;}
export function array(value:unknown,max:number):unknown[]{if(!Array.isArray(value)||value.length>max)return reject('REPORT_ARRAY_INVALID');return value;}
export function integer(value:unknown):number{if(!Number.isSafeInteger(value)||Number(value)<0)return reject('REPORT_COUNTER_INVALID');return value as number;}

// JSON.parse alone silently accepts duplicate object keys. Validate bounded tokens
// first, including keys, then let the native parser create the value.
export function parseReportJson(bytes:Uint8Array):unknown{return parseBoundedJson(bytes,qualityLimits.reportBytes);}
export function parseSourceJson(bytes:Uint8Array):unknown{return parseBoundedJson(bytes,16*1024*1024);}
function parseBoundedJson(bytes:Uint8Array,maximumBytes:number):unknown{
  if(bytes.byteLength>maximumBytes)return reject('REPORT_TOO_LARGE');
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return reject('REPORT_UTF8_INVALID');}
  let i=0,nodes=0;
  const ws=()=>{while(i<text.length&&/[\x20\t\r\n]/.test(text[i]!))i++;};
  const string=():string=>{const start=i++;while(i<text.length){const c=text[i++]!;if(c==='\\'){i++;continue;}if(c==='"'){try{return JSON.parse(text.slice(start,i)) as string;}catch{return reject('REPORT_JSON_INVALID');}}}return reject('REPORT_JSON_INVALID');};
  const value=(depth:number):void=>{
    if(depth>qualityLimits.jsonDepth||++nodes>qualityLimits.jsonNodes)return reject('REPORT_COMPLEXITY_LIMIT');ws();const c=text[i];
    if(c==='"'){string();return;}
    if(c==='{'||c==='['){const close=c==='{'?'}':']',keys=new Set<string>();i++;ws();if(text[i]===close){i++;return;}
      for(;;){if(c==='{'){if(text[i]!=='"')return reject('REPORT_JSON_INVALID');const key=string();if(keys.has(key))return reject('REPORT_DUPLICATE_KEY');keys.add(key);ws();if(text[i++]!==':')return reject('REPORT_JSON_INVALID');}
        value(depth+1);ws();if(text[i]===close){i++;return;}if(text[i++]!==',')return reject('REPORT_JSON_INVALID');ws();}
    }
    const token=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));if(!token)return reject('REPORT_JSON_INVALID');i+=token[0].length;
  };
  value(0);ws();if(i!==text.length)return reject('REPORT_JSON_INVALID');
  try{return JSON.parse(text) as unknown;}catch{return reject('REPORT_JSON_INVALID');}
}
