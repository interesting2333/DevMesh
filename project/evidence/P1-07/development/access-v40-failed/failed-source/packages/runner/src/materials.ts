import { constants } from 'node:fs';
import { mkdir,open,lstat,link,unlink } from 'node:fs/promises';
import { join,dirname } from 'node:path';
import { createHash,randomUUID } from 'node:crypto';
import { canonicalRoot } from '@devmesh/blob-store';
import { RunnerError } from './protocol.js';
import type { Job,ExecutionBackend } from './protocol.js';

export class RunnerMaterials {
 constructor(readonly root:string,readonly maximumBytes=64*1024*1024){canonicalRoot(root);}
 private async put(job:Job,name:string,bytes:Uint8Array){
  const directory=join(this.root,'job-outputs',job.jobId);canonicalRoot(directory);await mkdir(directory,{recursive:true,mode:0o700});
  const sha256=createHash('sha256').update(bytes).digest('hex'),path=join(directory,sha256+'-'+name),temp=join(directory,'.pending-'+randomUUID());
  const file=await open(temp,'wx',0o600);try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
  try{await link(temp,path);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const previous=await this.read('job-outputs/'+job.jobId+'/'+sha256+'-'+name);if(previous.length!==bytes.length||createHash('sha256').update(previous).digest('hex')!==sha256)throw new RunnerError('RUNNER_OUTPUT_CORRUPT',409);}finally{await unlink(temp);}
  return {path:'job-outputs/'+job.jobId+'/'+sha256+'-'+name,sha256,byteSize:bytes.length};
 }
 async collect(job:Job,workspacePath:string,backend:ExecutionBackend){
  const log=await backend.logs(job);if(log.byteLength>1024*1024)throw new RunnerError('RUNNER_LOG_LIMIT',413);
  const outputRefs=[await this.put(job,'container.log',log)];let total=log.byteLength;canonicalRoot(workspacePath);
  for(const [index,name] of job.request.outputSpec.entries()){
   const parts=name.split('/');let current=workspacePath;
   for(const part of parts.slice(0,-1)){current=join(current,part);const s=await lstat(current);if(s.isSymbolicLink()||!s.isDirectory())throw new RunnerError('RUNNER_OUTPUT_LINK_DENIED',403);}
   const path=join(workspacePath,...parts),s=await lstat(path);if(s.isSymbolicLink()||!s.isFile()||s.nlink!==1||s.size>this.maximumBytes-total)throw new RunnerError('RUNNER_OUTPUT_LIMIT',413);
   const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);let bytes:Buffer;
   try{const opened=await file.stat();if(opened.dev!==s.dev||opened.ino!==s.ino||opened.nlink!==1||!opened.isFile()||opened.size!==s.size)throw new RunnerError('RUNNER_OUTPUT_CHANGED',409);bytes=Buffer.alloc(opened.size);let position=0;while(position<bytes.length){const r=await file.read(bytes,position,bytes.length-position,position);if(!r.bytesRead)throw new RunnerError('RUNNER_OUTPUT_CHANGED',409);position+=r.bytesRead;}const after=await file.stat();if(after.size!==opened.size||after.mtimeMs!==opened.mtimeMs)throw new RunnerError('RUNNER_OUTPUT_CHANGED',409);}finally{await file.close();}
   total+=bytes.length;outputRefs.push(await this.put(job,'output-'+index,bytes));
  }
  // Files are retained indefinitely until a later authenticated archive ACK protocol.
  return {logCursor:log.byteLength,outputRefs};
 }
 async read(path:string){
  if(!/^job-outputs\/job_[A-Za-z0-9_-]+\/[a-f0-9]{64}-(container\.log|output-[0-9]+)$/.test(path))throw new RunnerError('RUNNER_OUTPUT_DENIED',403);
  canonicalRoot(dirname(join(this.root,path)));const file=await open(join(this.root,path),constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=await file.stat();if(!stat.isFile()||stat.nlink!==1||stat.size>this.maximumBytes)throw new RunnerError('RUNNER_OUTPUT_DENIED',403);return await file.readFile();}finally{await file.close();}
 }
}
