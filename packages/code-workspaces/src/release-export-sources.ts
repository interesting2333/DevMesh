import {lstat,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {canonicalRoot} from '@devmesh/blob-store';
import {canonical} from '@devmesh/storage-sqlite';
import type {ReleaseExportContext} from '@devmesh/storage-sqlite';
import {ControlledGit,WorkspaceError} from './git.js';
/** Read immutable accepted source objects; never enter a live workspace. */
export class LocalReleaseExportSources {
 readonly root:string;
 constructor(controlDataRoot:string){this.root=canonicalRoot(controlDataRoot);}
 async read(context:ReleaseExportContext,signal:AbortSignal){
  const s=context.snapshot,{identity,manifest}=s.source;
  if(identity.root!==join(await realpath(this.root),'repositories',s.release.projectId,'repo.git'))throw new WorkspaceError('EXPORT_SOURCE_CHANGED');
  const git=await ControlledGit.open(identity.root,'bare'),[r,g]=await Promise.all([lstat(git.identity.root,{bigint:true}),lstat(git.identity.gitDirectory,{bigint:true})]);
  const actual={root:git.identity.root,gitDirectory:git.identity.gitDirectory,commonDirectory:git.identity.commonDirectory,rootDevice:String(r.dev),rootFileId:String(r.ino),gitDevice:String(g.dev),gitFileId:String(g.ino)};
  if(canonical(actual)!==canonical(identity)||canonical(await git.manifest(s.codeCommit,signal))!==canonical(manifest))throw new WorkspaceError('EXPORT_SOURCE_CHANGED');
  const files=[];for(const f of manifest.files){signal.throwIfAborted();files.push({path:f.path,bytes:await git.readBlob(f.objectId,signal),mode:f.mode});}
  await git.validate(signal);return files;
 }
}
