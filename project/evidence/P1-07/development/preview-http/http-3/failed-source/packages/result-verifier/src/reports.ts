import {qualityLimits,qualityLocation,qualityBranch} from '@devmesh/contracts';
import type {QualitySourceScope} from '@devmesh/contracts';
import {array,integer,object,parseReportJson,reject} from './json.js';
import {canonical,normalizeReportPath} from './source.js';

type SourceFile=QualitySourceScope['gitManifest'][number];
export type FileCoverage={path:string;statements:Map<string,{loc:typeof qualityLocation._output;hit:boolean}>;branches:Map<string,{branch:typeof qualityBranch._output;hits:boolean[]}>};
function location(raw:unknown,source:SourceFile,implicit=false):typeof qualityLocation._output|null{
  const v=object(raw),start=object(v.start),end=object(v.end);
  if(implicit&&!Object.keys(start).length&&!Object.keys(end).length)return null;
  const point=(p:Record<string,unknown>,endPoint=false)=>{const line=integer(p.line);if(line<1||line>source.lineLengths.length)return reject('REPORT_LOCATION_INVALID');const column=endPoint&&p.column===null?source.lineLengths[line-1]!:integer(p.column);if(column>source.lineLengths[line-1]!)return reject('REPORT_LOCATION_INVALID');return {line,column};};
  const parsed=qualityLocation.safeParse({start:point(start),end:point(end,true)});if(!parsed.success)return reject('REPORT_LOCATION_INVALID');return parsed.data;
}
function pairedKeys(map:Record<string,unknown>,counts:Record<string,unknown>):string[]{
  const keys=Object.keys(map).sort();if(keys.some(k=>!/^(?:0|[1-9]\d{0,8})$/.test(k))||canonical(keys)!==canonical(Object.keys(counts).sort()))return reject('REPORT_COUNTER_KEYS_MISMATCH');return keys;
}
// Parses only pinned Istanbul-compatible V8 output. The separately frozen
// instrumentation is checked by the evaluator, rather than trusted from here.
export function parseIstanbulReport(bytes:Uint8Array,prefixes:readonly string[],sources:readonly SourceFile[]):Map<string,FileCoverage>{
  const root=object(parseReportJson(bytes)),files=new Map<string,FileCoverage>(),folded=new Set<string>(),sourceMap=new Map(sources.map(f=>[f.path,f]));
  if(Object.keys(root).length>qualityLimits.files)return reject('REPORT_FILE_LIMIT');let positions=0;
  for(const [rawPath,raw] of Object.entries(root)){
    const path=normalizeReportPath(rawPath,prefixes),entry=object(raw),source=sourceMap.get(path);
    if(!source)return reject('REPORT_SOURCE_UNKNOWN');if(normalizeReportPath(entry.path,prefixes)!==path)return reject('REPORT_SOURCE_PATH_MISMATCH');
    if(folded.has(path.toLowerCase()))return reject('REPORT_PATH_AMBIGUOUS');folded.add(path.toLowerCase());
    const statements=new Map<string,{loc:typeof qualityLocation._output;hit:boolean}>(),branches=new Map<string,{branch:typeof qualityBranch._output;hits:boolean[]}>();
    const sm=object(entry.statementMap),s=object(entry.s),bm=object(entry.branchMap),b=object(entry.b),fm=object(entry.fnMap),f=object(entry.f);
    for(const id of pairedKeys(sm,s)){const loc=location(sm[id],source)!,key=canonical(loc);if(statements.has(key))return reject('REPORT_POSITION_AMBIGUOUS');statements.set(key,{loc,hit:integer(s[id])>0});positions++;}
    for(const id of pairedKeys(bm,b)){
      const rawBranch=object(bm[id]),locations=array(rawBranch.locations,128).map(l=>location(l,source,true));
      const parsed=qualityBranch.safeParse({type:rawBranch.type,loc:location(rawBranch.loc,source),locations});if(!parsed.success||locations.every(l=>!l)||locations.some(l=>!l)&&parsed.data.type!=='if')return reject('REPORT_BRANCH_INVALID');
      const hits=array(b[id],128).map(n=>integer(n)>0);if(hits.length!==locations.length)return reject('REPORT_BRANCH_COUNTER_MISMATCH');
      const key=canonical(parsed.data);if(branches.has(key))return reject('REPORT_POSITION_AMBIGUOUS');branches.set(key,{branch:parsed.data,hits});positions+=hits.length;
    }
    for(const id of pairedKeys(fm,f)){const fn=object(fm[id]);location(fn.loc,source);location(fn.decl,source);integer(f[id]);positions++;}
    if(positions>qualityLimits.positions)return reject('REPORT_POSITION_LIMIT');files.set(path,{path,statements,branches});
  }
  return files;
}
export type ParsedTests={cases:Map<string,'PASSED'|'FAILED'|'SKIPPED'>;failedSuites:number;runFailed:boolean};
export const testIdentity=(path:string,fullName:string):string=>path+'\0'+fullName;
export function parseVitestReport(bytes:Uint8Array,prefixes:readonly string[]):ParsedTests{
  const root=object(parseReportJson(bytes)),suites=array(root.testResults,qualityLimits.tests),cases:ParsedTests['cases']=new Map(),paths=new Set<string>();let failedSuites=0;
  for(const raw of suites){const suite=object(raw),path=normalizeReportPath(suite.name,prefixes);if(paths.has(path.toLowerCase()))return reject('TEST_SUITE_AMBIGUOUS');paths.add(path.toLowerCase());
    if(!['passed','failed','pending','skipped','todo'].includes(String(suite.status)))return reject('TEST_STATUS_UNKNOWN');
    if(suite.status!=='passed'||suite.message!==undefined&&suite.message!=='')failedSuites++;
    for(const rawCase of array(suite.assertionResults,qualityLimits.tests)){
      const item=object(rawCase);if(typeof item.fullName!=='string'||!item.fullName.length||item.fullName.length>4096)return reject('TEST_IDENTITY_INVALID');
      const id=testIdentity(path,item.fullName);if(cases.has(id))return reject('TEST_IDENTITY_AMBIGUOUS');
      const status=item.status==='passed'?'PASSED':item.status==='failed'?'FAILED':['pending','skipped','todo','disabled'].includes(String(item.status))?'SKIPPED':reject('TEST_STATUS_UNKNOWN');
      if(status==='PASSED'&&item.failureMessages!==undefined&&array(item.failureMessages,256).length)return reject('TEST_STATUS_CONTRADICTORY');
      cases.set(id,status);if(cases.size>qualityLimits.tests)return reject('TEST_CASE_LIMIT');
    }
  }
  const snapshot=root.snapshot===undefined?{}:object(root.snapshot);
  const runFailed=root.success!==true||failedSuites>0||snapshot.failure===true||typeof root.numRuntimeErrorTestSuites==='number'&&root.numRuntimeErrorTestSuites>0||Array.isArray(root.unhandledErrors)&&root.unhandledErrors.length>0;
  return {cases,failedSuites,runFailed};
}
