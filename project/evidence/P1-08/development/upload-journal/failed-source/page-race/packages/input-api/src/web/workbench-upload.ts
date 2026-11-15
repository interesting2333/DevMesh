import {z} from 'zod';
import {attachmentName,attachmentView,ids,inputLimits,inputOperation,opaqueKey,revision,sha256,timestamp,uploadMetadata} from '@devmesh/contracts';

export const uploadEnvelope=z.strictObject({
 key:z.uuid(),principalId:opaqueKey,scope:z.literal('uploads'),path:z.literal('/api/v1/attachments'),
 metadata:uploadMetadata,mime:z.enum(['text/plain','text/markdown']),byteSize:z.number().int().min(1).max(inputLimits.attachmentBytes),contentHash:sha256,createdAt:timestamp,
});
export const uploadRecord=z.strictObject({
 key:z.uuid(),principalId:opaqueKey,envelope:uploadEnvelope,bytes:z.custom<Uint8Array>(v=>v instanceof Uint8Array).nullable(),revision,
 receipt:inputOperation.nullable(),observedAt:timestamp.nullable(),attachment:attachmentView.nullable(),verifiedAt:timestamp.nullable(),releasedAt:timestamp.nullable(),
});
export type LocalUpload=z.output<typeof uploadRecord>;
export const uploadResponse=z.strictObject({attachment:attachmentView,operationId:ids.operation});
export const uploadLimits=Object.freeze({residentFiles:32,records:256});
export class UploadValidationError extends Error {readonly code='INVALID_UPLOAD';constructor(){super('Invalid attachment');}}
const invalid=():never=>{throw new UploadValidationError();};
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))).map(n=>n.toString(16).padStart(2,'0')).join('');

/** Validate and copy the exact original bytes before any local transaction or HTTP. */
export async function prepareUpload(principalId:string,file:File):Promise<LocalUpload>{
 opaqueKey.parse(principalId);
 if(!(file instanceof File)||!attachmentName.safeParse(file.name).success||file.size<1||file.size>inputLimits.attachmentBytes)invalid();
 const suffix=file.name.toLowerCase().split('.').at(-1),mime=suffix==='txt'?'text/plain':suffix==='md'||suffix==='markdown'?'text/markdown':invalid();
 if(file.type&&file.type!==mime)invalid();
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(bytes.byteLength!==file.size)invalid();
 try{if(new TextDecoder('utf-8',{fatal:true}).decode(bytes).includes('\0'))invalid();}catch{invalid();}
 const key=crypto.randomUUID(),createdAt=new Date().toISOString();
 return uploadRecord.parse({key,principalId,envelope:{key,principalId,scope:'uploads',path:'/api/v1/attachments',metadata:{clientAttachmentId:crypto.randomUUID(),name:file.name},mime,byteSize:bytes.byteLength,contentHash:await digest(bytes),createdAt},bytes,revision:1,receipt:null,observedAt:null,attachment:null,verifiedAt:null,releasedAt:null});
}

/** Hashing runs outside IDB transactions; admission compares these exact bytes again. */
export async function verifyUploadBytes(value:LocalUpload){
 if(value.bytes!==null&&await digest(value.bytes)!==value.envelope.contentHash)invalid();
 return value;
}

export function sameUploadBytes(a:Uint8Array|null,b:Uint8Array|null){return a===null||b===null?a===b:a.byteLength===b.byteLength&&a.every((n,i)=>n===b[i]);}
