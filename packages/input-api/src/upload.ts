import Busboy from 'busboy';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import type { Request } from 'express';
import { attachmentName, uploadMetadata } from '@devmesh/contracts';
import { canonical, StorageError } from '@devmesh/storage-sqlite';
import type { UploadIntake } from '@devmesh/storage-sqlite';
import { safePath } from '@devmesh/blob-store';
import type { LocalContentStore } from '@devmesh/blob-store';

const limit=2*1024*1024,totalLimit=limit+32*1024;
function fail(code:string,status:number,message:string):never{throw new StorageError(code,status,message);}
export async function receiveUpload(request:Request,content:LocalContentStore,principalId:string,idempotencyKey:string):Promise<UploadIntake>{
  const claimToken=randomUUID();
  const intake=await content.storage.request('claimUploadIntake',{meta:{principalId,scopeId:'uploads',idempotencyKey},claimToken});
  // Each original key owns a durable, unique path. Replays hash a bounded stream
  // without reopening that path; an unfinished original is never taken over.
  if(!intake.claimed&&['RECEIVING','VALIDATED'].includes(intake.state))fail('UPLOAD_IN_PROGRESS',409,'Query the original upload operation before retrying');
  if(!intake.claimed&&['FAILED','INTERRUPTED'].includes(intake.state))fail(intake.errorCode??'UPLOAD_FAILED',409,'The original upload failed; remove that item or start a new upload intent');
  let filePath:string;
  let staged:Awaited<ReturnType<typeof open>>|undefined;
  let aborted:Error|undefined,bodyBytes=0,fileBytes=0,files=0;
  const fields:Record<string,string>={},hash=createHash('sha256'),decoder=new TextDecoder('utf-8',{fatal:true});
  const streams=new Set<{destroy(error?:Error):unknown}>();
  const abort=(error:Error)=>{
    aborted??=error;request.unpipe();
    for(const stream of streams)stream.destroy(error);
    // Do not destroy the request socket before a bounded public error can be sent.
    request.resume();
  };
  const timer=setTimeout(()=>abort(new StorageError('UPLOAD_TIMEOUT',408,'Upload deadline exceeded')),30000);timer.unref();
  const disconnected=()=>abort(new StorageError('UPLOAD_INTERRUPTED',409,'Upload connection ended before completion'));
  request.once('aborted',disconnected);
  try{
    // Path validation can fail after the durable claim and must share the same
    // failure-finalization boundary as opening or receiving the file.
    filePath=safePath(join(content.dataRoot,'staging'),intake.stagingKey,true);
    if(intake.claimed)staged=await open(filePath,'wx',0o600);
    if(aborted)throw aborted;
    let parser:ReturnType<typeof Busboy>;
    // Pinned Busboy hard bounds each part header to 16 KiB / 2,000 pairs.
    // Its implementation does not honor a lower headerPairs option.
    // partsLimit fires when its count is reached, including a valid final part.
    // The file/field counters enforce two accepted parts; the third is rejected.
    try{parser=Busboy({headers:request.headers,preservePath:true,defParamCharset:'utf8',limits:{fileSize:limit+1,files:1,fields:1,fieldNameSize:64,fieldSize:128,parts:3}});}
    catch{fail('MULTIPART_INVALID',422,'Expected a bounded multipart form');}
    let processing:Promise<void>|undefined;
    const bounded=new Transform({transform(chunk:Buffer,_encoding,callback){bodyBytes+=chunk.length;if(bodyBytes>totalLimit)callback(new StorageError('UPLOAD_TOO_LARGE',413,'Multipart body exceeds its byte budget'));else callback(null,chunk);}});
    streams.add(bounded);streams.add(parser!);
    const complete=new Promise<void>((resolve,reject)=>{
      parser!.once('close',resolve);parser!.once('error',error=>reject(error instanceof StorageError?error:new StorageError('MULTIPART_INVALID',422,'Multipart framing or headers are invalid')));bounded.once('error',reject);
      parser!.on('field',(name,value,info)=>{if(name!=='clientAttachmentId'||fields[name]!==undefined||info.nameTruncated||info.valueTruncated){abort(new StorageError('MULTIPART_INVALID',422,'Unexpected or duplicate upload metadata'));return;}fields[name]=value;});
      parser!.on('file',(name,stream,info)=>{
        files++;streams.add(stream);
        stream.on('error',()=>{});
        // Attach immediately so invalid metadata cannot leave an unconsumed part.
        processing=(async()=>{
          if(name!=='file'||files!==1)fail('MULTIPART_INVALID',422,'Exactly one file part is required');
          if(!['text/plain','text/markdown'].includes(info.mimeType))fail('ATTACHMENT_TYPE_INVALID',422,'Only UTF-8 plain text and Markdown are supported');
          const filename=attachmentName.parse(info.filename);
          if(!/\.(md|markdown|txt)$/i.test(filename))fail('ATTACHMENT_TYPE_INVALID',422,'Use a Markdown or text filename');
          fields.name=filename;
          stream.once('limit',()=>abort(new StorageError('UPLOAD_TOO_LARGE',413,'Attachment exceeds 2 MiB')));
          for await(const chunk of stream){
            const bytes=Buffer.from(chunk);fileBytes+=bytes.length;
            if(fileBytes>limit)fail('UPLOAD_TOO_LARGE',413,'Attachment exceeds 2 MiB');
            const text=decoder.decode(bytes,{stream:true});if(text.includes('\0'))fail('ATTACHMENT_ENCODING_INVALID',422,'Attachment contains NUL bytes');
            hash.update(bytes);if(staged)await staged.writeFile(bytes);
          }
          const tail=decoder.decode();if(tail.includes('\0'))fail('ATTACHMENT_ENCODING_INVALID',422,'Attachment contains NUL bytes');
          if(stream.truncated)fail('UPLOAD_TOO_LARGE',413,'Attachment exceeds 2 MiB');
          if(fileBytes===0)fail('ATTACHMENT_EMPTY',422,'Attachment is empty');
        })();
        processing.catch(error=>{abort(error instanceof TypeError?new StorageError('ATTACHMENT_ENCODING_INVALID',422,'Attachment must contain valid UTF-8'):error);reject(aborted);});
      });
      for(const name of ['filesLimit','fieldsLimit','partsLimit'] as const)parser!.once(name,()=>{const error=new StorageError('MULTIPART_INVALID',422,'Multipart part limit exceeded');abort(error);reject(error);});
    });
    request.pipe(bounded).pipe(parser!);
    await complete;await processing;
    if(aborted)throw aborted;
    if(files!==1||!fields.name)fail('MULTIPART_INVALID',422,'Exactly one file part is required');
    const metadata=uploadMetadata.parse({clientAttachmentId:fields.clientAttachmentId,name:fields.name});
    if(staged){await staged.sync();await staged.close();staged=undefined;}
    const contentHash=hash.digest('hex'),requestHash=createHash('sha256').update(canonical({...metadata,byteSize:fileBytes,contentHash})).digest('hex');
    const validated=await content.storage.request('validateUploadIntake',{principalId,intakeId:intake.intakeId,claimToken,...metadata,requestHash,contentHash,byteSize:fileBytes});
    if(!intake.claimed)return validated;
    const written=await content.put({meta:{principalId,scopeId:`upload.${intake.intakeId}`,idempotencyKey},expectedHash:contentHash,expectedSize:fileBytes,mimeType:/\.(md|markdown)$/i.test(metadata.name)?'text/markdown; charset=utf-8':'text/plain; charset=utf-8',target:{kind:'attachment',...metadata}},createReadStream(filePath));
    if(typeof written.result?.attachmentId!=='string')fail('UPLOAD_RESULT_INVALID',503,'Published attachment result is unavailable');
    return await content.storage.request('commitUploadIntake',{principalId,intakeId:intake.intakeId,claimToken,contentHash,attachmentId:written.result.attachmentId});
  }catch(error){
    if(intake.claimed)await content.storage.request('failUploadIntake',{principalId,intakeId:intake.intakeId,claimToken,errorCode:error instanceof StorageError?error.code:'UPLOAD_INVALID'}).catch(()=>{});
    throw error;
  }finally{
    clearTimeout(timer);request.off('aborted',disconnected);if(staged)await staged.close();
    for(const stream of streams)stream.destroy();
    // Retention is explicit. A failed/registered intake does not authorize GC.
  }
}
