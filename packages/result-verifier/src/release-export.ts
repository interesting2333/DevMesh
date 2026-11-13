import {createHash} from 'node:crypto';
import type {LocalContentStore} from '@devmesh/blob-store';
import {canonical,redactExportRecord} from '@devmesh/storage-sqlite';
import type {ReleaseExportContext,ReleaseExportJob} from '@devmesh/storage-sqlite';
import {buildExportZip,exportLimits,ExportError} from './export-zip.js';
import type {ZipFile} from './export-zip.js';
export interface ReleaseExportSources {read(context:ReleaseExportContext,signal:AbortSignal):Promise<{path:string;bytes:Uint8Array;mode:'100644'|'100755'}[]>}
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
export class ReleaseExporter {
 readonly #inflight=new Map<string,Promise<ReleaseExportJob>>();
 constructor(readonly content:LocalContentStore,readonly sources:ReleaseExportSources){}
 advance(principalId:string,exportId:string,signal=new AbortController().signal):Promise<ReleaseExportJob>{
  const key=principalId+'\0'+exportId,old=this.#inflight.get(key);if(old)return old;
  if(this.#inflight.size>=2)return Promise.reject(new ExportError('EXPORT_PACK_CAPACITY'));
  const work=this.pack(principalId,exportId,signal).finally(()=>this.#inflight.delete(key));this.#inflight.set(key,work);return work;
 }
 private async pack(principalId:string,exportId:string,signal:AbortSignal){
  const storage=this.content.storage,context=await storage.request('claimReleaseExport',{principalId,exportId});
  if(!context)return storage.request('getReleaseExport',{principalId,exportId});
  const claim={principalId,exportId,generation:context.generation,claimToken:context.claimToken},s=context.snapshot;
  try{
   const files:ZipFile[]=[],items:{path:string;sha256:string;byteSize:number;originalSha256:string|null;transform:string}[]=[];let total=0;
   const add=(path:string,bytes:Uint8Array,originalSha256:string|null=null,transform='EXACT',mode:ZipFile['mode']='100644')=>{total+=bytes.byteLength;if(total>190*1024*1024||bytes.byteLength>exportLimits.entryBytes)throw new ExportError('EXPORT_LIMIT_EXCEEDED');files.push({path,bytes,mode});items.push({path,sha256:hash(bytes),byteSize:bytes.byteLength,originalSha256,transform});};
   const source=await this.sources.read(context,signal);if(source.length!==s.source.manifest.files.length)throw new ExportError('EXPORT_SOURCE_CHANGED');
   const found=new Set<string>();for(const f of source){signal.throwIfAborted();const original=s.source.manifest.files.find(e=>e.path===f.path);if(found.has(f.path)||!original||original.mode!==f.mode||original.byteSize!==f.bytes.byteLength||original.sha256!==hash(f.bytes))throw new ExportError('EXPORT_SOURCE_CHANGED');found.add(f.path);add('source/'+f.path,f.bytes,original.sha256,'EXACT',f.mode);}
   for(const m of s.materials){
    signal.throwIfAborted();await storage.request('getReleaseExportContext',claim);
    const bytes=await this.content.readBytes(principalId,{kind:'exportMaterial',exportId,materialKey:m.key,generation:claim.generation,claimToken:claim.claimToken},exportLimits.entryBytes);
    if(bytes.byteLength!==m.byteSize||hash(bytes)!==m.contentHash)throw new ExportError('EXPORT_MATERIAL_CHANGED');
    let output=bytes;if(m.transform==='REDACT_JSON'){let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new ExportError('EXPORT_RECORD_INVALID');}let value:unknown;try{value=JSON.parse(text);}catch{value=text;}output=Buffer.from(canonical(redactExportRecord(value)));}
    add(m.path,output,m.contentHash,m.transform);
   }
   add('records.json',Buffer.from(canonical(s.records)),null,'PLATFORM_PROJECTION');
   const manifest={schemaVersion:'devmesh.release-export.v1',scope:'ACCEPTED_RELEASE_DELIVERY',completeness:'COMPLETE_WITHIN_SCOPE',releaseId:s.release.releaseId,projectId:s.release.projectId,runId:s.release.runId,candidateId:s.candidateId,candidateRevision:s.candidateRevision,manifestHash:s.manifestHash,codeCommit:s.codeCommit,requirementRevision:s.requirementRevision,planRevision:s.planRevision,checkConfigHash:s.checkConfigHash,templateVersion:s.templateVersion,cutoffSeq:s.cutoffSeq,snapshotHash:context.job.snapshotHash,acceptedAt:s.release.acceptedAt,missing:[],excluded:['business-dataset','platform-credentials-and-runtime-authority','model-request-response-and-private-reasoning'],contentPolicy:'Project source/build/image bytes are exact approved deliverables; platform records are projected and redacted. This is not a platform restore archive or an arbitrary project secret scanner.',entryCount:items.length,files:items.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)};
   const body=Buffer.from(canonical(manifest));if(body.length>192*1024)throw new ExportError('EXPORT_LIMIT_EXCEEDED');files.push({path:'manifest.json',bytes:body});
   const archive=buildExportZip(files);await storage.request('prepareReleaseExportArchive',{...claim,hash:hash(archive),byteSize:archive.length,manifest});
   await this.content.putBytes({principalId,scopeId:exportId,idempotencyKey:context.writeKey},{kind:'releaseExport',exportId,generation:claim.generation,claimToken:claim.claimToken},archive,'application/zip');
   return await storage.request('getReleaseExport',{principalId,exportId});
  }catch(error){
   // A registered archive may have lost its ACK; never turn it into FAILED.
   const original=await storage.request('getReleaseExport',{principalId,exportId});if(original.state==='READY')return original;
   const cause=error instanceof Error&&'code' in error&&typeof error.code==='string'?error.code:'';
   const code=/^EXPORT_[A-Z_]+$/.test(cause)?cause:['CONTENT_MISSING','CONTENT_UNAVAILABLE'].includes(cause)?'EXPORT_MATERIAL_MISSING':cause==='CONTENT_CORRUPT'?'EXPORT_MATERIAL_CHANGED':signal.aborted?'EXPORT_INTERRUPTED':'EXPORT_PACK_FAILED';
   try{return await storage.request('failReleaseExport',{...claim,errorCode:code});}catch{throw error;}
  }
 }
}
