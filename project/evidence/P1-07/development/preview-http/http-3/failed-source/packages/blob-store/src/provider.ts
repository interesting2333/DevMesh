import { createHash } from 'node:crypto';
import { open, link, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import type { FileHandle } from 'node:fs/promises';
import type { ObjectWrite } from '@devmesh/storage-sqlite';
import { StorageError } from '@devmesh/storage-sqlite';
import { safePath, fail } from './paths.js';
import { checkCapacity, syncDirectory } from './layout.js';

export type ByteSource = Uint8Array | AsyncIterable<Uint8Array>;
export interface VerifiedFile { contentHash: string; byteSize: number }
export interface BlobProvider {
  stage(write: ObjectWrite, source: ByteSource): Promise<void>;
  publish(write: ObjectWrite): Promise<VerifiedFile>;
  openRead(contentHash: string, expectedSize: number): Promise<Readable>;
  verify(contentHash: string, expectedSize?: number): Promise<VerifiedFile>;
  delete(contentHash: string): Promise<void>;
}
export class LocalBlobProvider implements BlobProvider {
  constructor(readonly dataRoot: string, readonly minimumFreeBytes=64*1024*1024) {}
  #object(hash: string, create=false): string {
    if(!/^[a-f0-9]{64}$/.test(hash))fail('CONTENT_HASH_INVALID','Expected a SHA-256 content hash',422);
    return safePath(join(this.dataRoot,'artifacts'),`sha256/${hash.slice(0,2)}/${hash}`,create);
  }
  #stage(write: ObjectWrite): string {
    if(!/^objects\/write_[a-f0-9]{32}\.part$/.test(write.stagingKey))fail('STAGING_KEY_INVALID','Unexpected staging key',422);
    return safePath(join(this.dataRoot,'staging'),write.stagingKey);
  }
  async #verifyHandle(file: FileHandle, expectedHash: string, expectedSize?: number): Promise<VerifiedFile> {
    const stat=await file.stat();if(!stat.isFile() || (expectedSize!==undefined && stat.size!==expectedSize))fail('CONTENT_CORRUPT','Content size differs from its immutable reference',503);
    const hash=createHash('sha256');let size=0;
    for await(const chunk of file.createReadStream({start:0,autoClose:false})){hash.update(chunk);size+=chunk.length;}
    if(hash.digest('hex')!==expectedHash)fail('CONTENT_CORRUPT','Content hash differs from its immutable reference',503);
    return {contentHash:expectedHash,byteSize:size};
  }
  async verify(contentHash: string, expectedSize?: number): Promise<VerifiedFile> {
    let file: FileHandle;
    try{file=await open(this.#object(contentHash),'r');}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new StorageError('CONTENT_MISSING',503,'Referenced bytes are missing');throw error;}
    try{return await this.#verifyHandle(file,contentHash,expectedSize);}finally{await file.close();}
  }
  async stage(write: ObjectWrite, source: ByteSource): Promise<void> {
    await checkCapacity(this.dataRoot,write.expectedSize,this.minimumFreeBytes);
    const path=this.#stage(write);
    try{
      const old=await open(path,'r');
      try{await this.#verifyHandle(old,write.expectedHash,write.expectedSize);return;}
      catch(error){if(!(error instanceof StorageError) || error.code!=='CONTENT_CORRUPT')throw error;}
      finally{await old.close();}
      await unlink(path);
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    const file=await open(path,'wx',0o600),hash=createHash('sha256');let size=0;
    try{
      const chunks: AsyncIterable<Uint8Array> = source instanceof Uint8Array ? (async function*(){yield source;})() : source;
      for await(const chunk of chunks){
        if(!(chunk instanceof Uint8Array))fail('BYTE_SOURCE_INVALID','Content streams must contain bytes',422);
        size+=chunk.byteLength;if(size>write.expectedSize)fail('CONTENT_SIZE_MISMATCH','Received more bytes than declared',422);
        hash.update(chunk);let offset=0;
        while(offset<chunk.byteLength){const result=await file.write(chunk,offset,chunk.byteLength-offset);if(!result.bytesWritten)fail('CONTENT_WRITE_FAILED','No progress writing staged bytes',507);offset+=result.bytesWritten;}
      }
      if(size!==write.expectedSize || hash.digest('hex')!==write.expectedHash)fail('CONTENT_SIZE_MISMATCH','Actual content size/hash differs from the declaration',422);
      await file.sync();
    }finally{await file.close();}
    syncDirectory(dirname(path));
  }
  async publish(write: ObjectWrite): Promise<VerifiedFile> {
    const source=this.#stage(write),target=this.#object(write.expectedHash,true);
    // Verify staging even if called without stage(), and use no-overwrite link publication.
    const file=await open(source,'r');try{await this.#verifyHandle(file,write.expectedHash,write.expectedSize);}finally{await file.close();}
    try{await link(source,target);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;await this.verify(write.expectedHash,write.expectedSize);}
    syncDirectory(dirname(target));
    await unlink(source);syncDirectory(dirname(source));
    return this.verify(write.expectedHash,write.expectedSize);
  }
  async openRead(contentHash: string, expectedSize: number): Promise<Readable> {
    let file: FileHandle;
    try{file=await open(this.#object(contentHash),'r');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new StorageError('CONTENT_MISSING',503,'Referenced bytes are missing');throw error;}
    try{await this.#verifyHandle(file,contentHash,expectedSize);return file.createReadStream({start:0,autoClose:true});}catch(error){await file.close();throw error;}
  }
  /** Only call after the storage transaction reserved DELETING and checked references/pins. */
  async delete(contentHash: string): Promise<void> {
    const path=this.#object(contentHash);try{await unlink(path);syncDirectory(dirname(path));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  }
}
