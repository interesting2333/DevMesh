import {createHash} from 'node:crypto';
import {qualityPath,qualityPolicy,qualitySourceScope,qualityLimits} from '@devmesh/contracts';
import type {QualityPolicy,QualitySourceScope} from '@devmesh/contracts';
import {reject} from './json.js';

export const sha256=(value:string|Uint8Array):string=>createHash('sha256').update(value).digest('hex');
export function canonical(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value)??'undefined';
}
export function qualityPolicyHash(value:unknown):string{return sha256(canonical(qualityPolicy.parse(value)));}
const escape=(c:string)=>/[.*+?^${}()|[\]\\]/.test(c)?'\\'+c:c;
export function matchesGlob(path:string,glob:string):boolean{
  const compile=(p:string):string=>{let out='';for(let i=0;i<p.length;i++){const c=p[i]!;if(c==='*'){if(p[i+1]==='*'){i++;if(p[i+1]==='/'){i++;out+='(?:.*/)?';}else out+='.*';}else out+='[^/]*';}
    else if(c==='?')out+='[^/]';else if(c==='{'){const end=p.indexOf('}',i);if(end<0||p.slice(i+1,end).includes('{'))return reject('QUALITY_GLOB_UNSUPPORTED');out+='(?:'+p.slice(i+1,end).split(',').map(compile).join('|')+')';i=end;}
    else if(c==='}'||c==='['||c===']')return reject('QUALITY_GLOB_UNSUPPORTED');else out+=escape(c);}return out;};
  return new RegExp('^'+compile(glob)+'$').test(path);
}
export const selectedBusiness=(path:string,policy:QualityPolicy):boolean=>policy.business.include.some(g=>matchesGlob(path,g))&&!policy.business.exclude.some(e=>matchesGlob(path,e.glob));
export function normalizeReportPath(raw:unknown,prefixes:readonly string[]):string{
  if(typeof raw!=='string'||raw.length>2048)return reject('REPORT_PATH_INVALID');
  const value=raw.replaceAll('\\','/');let path=value;
  if(value.startsWith('/')||/^[A-Za-z]:/.test(value)){const matches=prefixes.filter(p=>value.startsWith(p+'/'));if(matches.length!==1)return reject('REPORT_PATH_UNMAPPED');path=value.slice(matches[0]!.length+1);}
  if(!qualityPath.safeParse(path).success)return reject('REPORT_PATH_INVALID');return path;
}
function uniquePaths(paths:readonly string[]):void{const folded=new Set<string>();for(const p of paths){const key=p.toLowerCase();if(folded.has(key))return reject('SOURCE_PATH_AMBIGUOUS');folded.add(key);}}
export function normalizeTopology<T extends QualitySourceScope['businessFiles']>(files:T):QualitySourceScope['businessFiles']{
  return files.map(f=>({...f,statements:[...f.statements].sort((a,b)=>canonical(a).localeCompare(canonical(b),'en')),branches:[...f.branches].sort((a,b)=>canonical(a).localeCompare(canonical(b),'en'))})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export function assertQualityScope(raw:unknown,policy:QualityPolicy):QualitySourceScope{
  const scope=qualitySourceScope.parse(raw);if(scope.checkConfigHash!==qualityPolicyHash(policy))return reject('SOURCE_POLICY_STALE');
  uniquePaths(scope.gitManifest.map(f=>f.path));uniquePaths(scope.businessFiles.map(f=>f.path));
  const manifest=[...scope.gitManifest].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),topology=normalizeTopology(scope.businessFiles);
  if(sha256(canonical(manifest))!==scope.sourceManifestSha256||sha256(canonical(topology))!==scope.topologySha256)return reject('SOURCE_PROOF_HASH_MISMATCH');
  const expected=manifest.filter(f=>selectedBusiness(f.path,policy));
  if(canonical(expected.map(f=>f.path))!==canonical(topology.map(f=>f.path)))return reject('SOURCE_SCOPE_INCOMPLETE');
  const covered=new Set<string>();for(const r of policy.reports.filter(r=>r.format==='istanbul-v1'))for(const f of expected)if(r.sourceInclude.some(g=>matchesGlob(f.path,g)))covered.add(f.path);
  if(expected.some(f=>!covered.has(f.path)))return reject('SOURCE_PRODUCER_MISSING');
  let positions=0;
  for(const file of topology){const source=expected.find(f=>f.path===file.path)!;
    const validate=(loc:QualitySourceScope['businessFiles'][number]['statements'][number])=>{
      for(const point of [loc.start,loc.end])if(point.line>source.lineLengths.length||point.column>source.lineLengths[point.line-1]!)return reject('SOURCE_LOCATION_INVALID');
    };
    const unique=(items:unknown[])=>{if(new Set(items.map(canonical)).size!==items.length)return reject('SOURCE_POSITION_AMBIGUOUS');};
    unique(file.statements);unique(file.branches);for(const loc of file.statements)validate(loc);
    for(const b of file.branches){validate(b.loc);if(b.locations.every(l=>l===null)||b.locations.some(l=>l===null)&&b.type!=='if')return reject('SOURCE_BRANCH_INVALID');for(const loc of b.locations)if(loc)validate(loc);positions+=b.locations.length;}
    positions+=file.statements.length;if(positions>qualityLimits.positions)return reject('SOURCE_COMPLEXITY_LIMIT');
  }
  return {...scope,gitManifest:manifest,businessFiles:topology};
}
// Trusted deployment entry only: supply the full original Git manifest and
// independently pinned pre-execution instrumentation, never agent report hits.
export function freezeQualitySourceScope(input:{policy:unknown;targetCommit:string;gitManifest:QualitySourceScope['gitManifest'];businessFiles:QualitySourceScope['businessFiles']}):QualitySourceScope{
  const policy=qualityPolicy.parse(input.policy),gitManifest=[...input.gitManifest].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),businessFiles=normalizeTopology(input.businessFiles);
  return assertQualityScope({schemaVersion:'devmesh.quality-source.v1',targetCommit:input.targetCommit,checkConfigHash:qualityPolicyHash(policy),sourceManifestSha256:sha256(canonical(gitManifest)),topologySha256:sha256(canonical(businessFiles)),gitManifest,businessFiles},policy);
}
