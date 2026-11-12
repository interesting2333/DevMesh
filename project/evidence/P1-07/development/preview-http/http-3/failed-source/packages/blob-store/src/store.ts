import { createHash, randomUUID } from 'node:crypto';
import { open, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { canonical, StorageError } from '@devmesh/storage-sqlite';
import type { ContentInfo, ContentReference, ContextManifest, ObjectTarget, ObjectWrite, Request, SessionInfo, SqliteStorage } from '@devmesh/storage-sqlite';
import { LocalBlobProvider } from './provider.js';
import type { BlobProvider, ByteSource } from './provider.js';
import { fail, safePath } from './paths.js';
import { syncDirectory } from './layout.js';

export type WriteMeta = Request<'beginObjectWrite'>['meta'];
export type BeginWrite = Request<'beginObjectWrite'>;
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const textDecoder = new TextDecoder('utf-8',{fatal:true});

export class LocalContentStore {
  readonly #inflight = new Map<string,Promise<ObjectWrite>>();
  readonly provider: BlobProvider;
  constructor(readonly storage: SqliteStorage, readonly dataRoot: string, minimumFreeBytes=64*1024*1024, provider?: BlobProvider) {
    this.provider=provider??new LocalBlobProvider(dataRoot,minimumFreeBytes);
  }
  async put(input: BeginWrite, source: ByteSource): Promise<ObjectWrite> {
    const write=await this.storage.request('beginObjectWrite',input);
    const existing=this.#inflight.get(write.writeId);if(existing)return existing;
    const promise=this.#complete(write,source);
    this.#inflight.set(write.writeId,promise);
    try{return await promise;}finally{this.#inflight.delete(write.writeId);}
  }
  async #complete(write: ObjectWrite, source?: ByteSource): Promise<ObjectWrite> {
    if(write.state==='REGISTERED')return write;
    let published=false;
    try{
      try{const existing=await this.provider.verify(write.expectedHash);if(existing.byteSize!==write.expectedSize)fail('CONTENT_SIZE_MISMATCH','Declared size differs from the verified bytes',422);published=true;}
      catch(error){
        if(!(error instanceof StorageError) || error.code!=='CONTENT_MISSING')throw error;
        if(source===undefined)throw error;
        await this.provider.stage(write,source);
        await this.provider.publish(write);published=true;
      }
      await this.storage.request('sealObjectWrite',{principalId:write.ownerId,writeId:write.writeId});
      return await this.storage.request('commitObjectWrite',{principalId:write.ownerId,writeId:write.writeId});
    }catch(error){
      if(!published)await this.storage.request('failObjectWrite',{principalId:write.ownerId,writeId:write.writeId,error:error instanceof Error?error.message.slice(0,2000):'Content write failed'}).catch(()=>{});
      throw error;
    }
  }
  putBytes(meta: WriteMeta, target: ObjectTarget, bytes: Uint8Array, mimeType='application/octet-stream'): Promise<ObjectWrite> {
    return this.put({meta,target,expectedHash:digest(bytes),expectedSize:bytes.byteLength,mimeType},bytes);
  }
  putText(meta: WriteMeta, target: ObjectTarget, text: string, mimeType='text/plain; charset=utf-8'): Promise<ObjectWrite> {
    return this.putBytes(meta,target,Buffer.from(text,'utf8'),mimeType);
  }
  putJson(meta: WriteMeta, target: ObjectTarget, value: unknown): Promise<ObjectWrite> {
    return this.putText(meta,target,canonical(value),'application/json');
  }
  async recoverPublished(): Promise<{ recovered: string[]; pending: {writeId:string;code:string}[] }> {
    const recovered: string[]=[],pending:{writeId:string;code:string}[]=[];let cursor='';
    while(true){
      const page=await this.storage.request('scanObjectWrites',{afterWriteId:cursor,limit:200});if(!page.length)break;
      for(const write of page){
        try{await this.#complete(write);recovered.push(write.writeId);}
        catch(error){pending.push({writeId:write.writeId,code:error instanceof StorageError?error.code:'CONTENT_FAILURE'});}
      }
      cursor=page.at(-1)!.writeId;
    }
    return {recovered,pending};
  }
  async verifyAll(): Promise<{ checked:number; failures:{contentHash:string;code:string}[] }> {
    let cursor='',checked=0;const failures:{contentHash:string;code:string}[]=[];
    while(true){
      const rows=await this.storage.request('listContentObjects',{afterHash:cursor,limit:200});if(!rows.length)break;
      for(const row of rows){
        if(row.state==='DELETING')continue;
        checked++;
        try{await this.provider.verify(row.contentHash,row.byteSize);if(row.state!=='READY')fail('CONTENT_UNAVAILABLE','Content requires explicit restoration',503);}
        catch(error){
          const code=error instanceof StorageError?error.code:'CONTENT_FAILURE';
          if(code==='CONTENT_MISSING'||code==='CONTENT_CORRUPT')await this.storage.request('markContentMissing',{contentHash:row.contentHash,error:code});
          failures.push({contentHash:row.contentHash,code});
        }
      }
      cursor=rows.at(-1)!.contentHash;
    }
    return {checked,failures};
  }
  async openRead(principalId: string, reference: ContentReference): Promise<{stream:Readable;content:ContentInfo;release():Promise<void>}> {
    const content=await this.storage.request('resolveContentRead',{principalId,reference});
    let released:Promise<void>|undefined;
    const release=()=>released??=(async()=>{await this.storage.request('releaseContentRead',{principalId,pinId:content.pinId});})();
    try{
      const stream=await this.provider.openRead(content.contentHash,content.byteSize);
      stream.once('close',()=>{void release().catch(()=>{});});
      return {stream,content,release};
    }catch(error){
      if(error instanceof StorageError && ['CONTENT_MISSING','CONTENT_CORRUPT'].includes(error.code))await this.storage.request('markContentMissing',{contentHash:content.contentHash,error:error.code});
      await release();throw error;
    }
  }
  async readBytes(principalId: string, reference: ContentReference, maxBytes=32*1024*1024): Promise<Uint8Array> {
    const opened=await this.openRead(principalId,reference);
    try{
      if(opened.content.byteSize>maxBytes)fail('CONTENT_TOO_LARGE','Use streaming reads for this object',413);
      const chunks:Buffer[]=[];let size=0;
      for await(const chunk of opened.stream){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>maxBytes)fail('CONTENT_TOO_LARGE','Read exceeds its byte budget',413);chunks.push(bytes);}
      return Buffer.concat(chunks);
    }finally{opened.stream.destroy();await opened.release();}
  }
  async readText(principalId:string,reference:ContentReference,maxBytes=32*1024*1024):Promise<string>{return textDecoder.decode(await this.readBytes(principalId,reference,maxBytes));}
  /** Maintenance primitive only. The caller supplies the retention decision; no automatic GC. */
  async deleteUnreferenced(contentHash:string):Promise<void>{await this.storage.request('beginContentDeletion',{contentHash});await this.provider.delete(contentHash);await this.storage.request('finishContentDeletion',{contentHash});}
}

function modelPayload(value: unknown, depth=0): void {
  if(depth>64)fail('MODEL_PAYLOAD_INVALID','Model payload nesting is too deep',422);
  if(Array.isArray(value)){for(const item of value)modelPayload(item,depth+1);return;}
  if(value && typeof value==='object')for(const [key,item] of Object.entries(value)){
    if(/^(authorization|cookie|set-cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|reasoning_content|thinking|chain_of_thought)$/i.test(key))fail('PRIVATE_MODEL_FIELD','Transport credentials and internal reasoning cannot be persisted in model payloads',422);
    modelPayload(item,depth+1);
  }
}
export class SessionStore {
  constructor(readonly content: LocalContentStore) {}
  get storage(): SqliteStorage{return this.content.storage;}
  ensure(principalId:string,runId:string,attemptId:string):Promise<SessionInfo>{return this.storage.request('ensureSession',{principalId,runId,attemptId});}
  append(meta:WriteMeta,target:Extract<ObjectTarget,{kind:'message'}>,text:string):Promise<ObjectWrite>{return this.content.putText(meta,target,text);}
  async snapshot(meta:WriteMeta,sessionId:string,configHash:string):Promise<ObjectWrite>{
    const s=await this.storage.request('getSession',{principalId:meta.principalId,sessionId});
    if(s.lastMessageSeq>200)fail('CONTEXT_COMPRESSION_REQUIRED','Prepare an explicit summary before creating a larger context',409);
    const page=await this.storage.request('listSessionMessages',{principalId:meta.principalId,sessionId,limit:200});
    const manifest:ContextManifest={schemaVersion:'devmesh.context.v1',sessionId,roleSnapshotId:s.roleSnapshotId,throughMessageSeq:s.lastMessageSeq,configHash,messages:page.messages.filter(m=>m.seq<=s.lastMessageSeq).map(m=>({messageId:m.messageId,seq:m.seq,sha256:m.contentHash}))};
    return this.content.putJson(meta,{kind:'context',manifest},manifest);
  }
  async saveRequest(meta:WriteMeta,target:Extract<ObjectTarget,{kind:'modelRequest'}>,request:unknown):Promise<ObjectWrite>{modelPayload(request);return this.content.putJson(meta,target,request);}
  async saveResponse(meta:WriteMeta,target:Extract<ObjectTarget,{kind:'modelResponse'}>,response:unknown):Promise<ObjectWrite>{modelPayload(response);return this.content.putJson(meta,target,response);}
  async exportJsonl(principalId:string,sessionId:string):Promise<{throughMessageSeq:number;sha256:string;manifestPath:string;transcriptPath:string}>{
    const s=await this.storage.request('getSession',{principalId,sessionId});
    const key=`sessions/${sessionId}/transcript.jsonl`,root=join(this.content.dataRoot,'views');
    const transcriptPath=safePath(root,key,true),manifestPath=safePath(root,`sessions/${sessionId}/manifest.json`);
    const temporary=transcriptPath+'.'+randomUUID().replaceAll('-','')+'.part';
    const file=await open(temporary,'wx',0o600),hash=createHash('sha256');let cursor=0;
    try{
      while(cursor<s.lastMessageSeq){
        const page=await this.storage.request('listSessionMessages',{principalId,sessionId,afterSeq:cursor,limit:200});
        if(!page.messages.length)fail('SESSION_HISTORY_GAP','Cannot project a missing message sequence',503);
        for(const m of page.messages){if(m.seq>s.lastMessageSeq)break;
          if(m.seq!==cursor+1)fail('SESSION_HISTORY_GAP','Cannot project a missing message sequence',503);
          const body=await this.content.readText(principalId,{kind:'message',messageId:m.messageId});
          const line=canonical({...m,body})+'\n';await file.writeFile(line,'utf8');hash.update(line);cursor=m.seq;
        }
      }
      await file.sync();
    }finally{await file.close();}
    const checksum=hash.digest('hex');await rename(temporary,transcriptPath);syncDirectory(dirname(transcriptPath));
    const manifest={schemaVersion:'devmesh.session-view.v1',sessionId,runId:s.runId,attemptId:s.attemptId,throughMessageSeq:cursor,sourceRevision:{lastStepNo:s.lastStepNo,lastMessageSeq:s.lastMessageSeq},generatedAt:new Date().toISOString(),sha256:checksum};
    const stagedManifest=manifestPath+'.'+randomUUID().replaceAll('-','')+'.part',output=await open(stagedManifest,'wx',0o600);
    try{await output.writeFile(canonical(manifest)+'\n','utf8');await output.sync();}finally{await output.close();}
    await rename(stagedManifest,manifestPath);syncDirectory(dirname(manifestPath));
    return {throughMessageSeq:cursor,sha256:checksum,manifestPath,transcriptPath};
  }
}
