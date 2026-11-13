// Formal candidate/review/T5 and real control Worker/CAS/Git export. Historical
// source admission, OCI/build/Runner physical facts remain explicit fixtures.
import {mkdtemp,mkdir,writeFile,lstat,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {ControlledGit,LocalReleaseExportSources} from '../../packages/code-workspaces/dist/index.mjs';
import {LocalContentStore} from '../../packages/blob-store/dist/index.mjs';
import {ReleaseExporter} from '../../packages/result-verifier/dist/index.mjs';
import {committedPublicationFixture} from './release-publication.mjs';
import {archiveGit} from './source-archive.mjs';
import {meta} from './storage-data.mjs';
export async function releaseExportFixture(t){
 const root=await mkdtemp(join(tmpdir(),'devmesh-export-')),control=join(root,'control'),checkout=join(root,'source');
 t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(checkout,'src'),{recursive:true});await mkdir(control);
 const sourceBytes=Buffer.from(('//'+'.'.repeat(78)+'\n').repeat(100));await writeFile(join(checkout,'src','app.ts'),sourceBytes);
 await archiveGit(checkout,'init','--quiet');await archiveGit(checkout,'config','user.name','Export fixture');await archiveGit(checkout,'config','user.email','export@localhost');await archiveGit(checkout,'add','.');await archiveGit(checkout,'commit','--quiet','--no-gpg-sign','-m','Original accepted source');
 const commit=await archiveGit(checkout,'rev-parse','HEAD'),git=await ControlledGit.open(checkout,'checkout'),manifest=await git.manifest(commit);
 const f=await committedPublicationFixture(t,{sourceManifest:manifest,async repositoryIdentity(p){const parent=join(control,'repositories',p.projectId);await mkdir(parent,{recursive:true});const repo=await ControlledGit.initialize(join(parent,'repo.git'),'bare');await repo.importCommit(await git.exportCommit(commit),commit);const a=repo.identity,[r,g]=await Promise.all([lstat(a.root,{bigint:true}),lstat(a.gitDirectory,{bigint:true})]);return {root:a.root,gitDirectory:a.gitDirectory,commonDirectory:a.commonDirectory,rootDevice:String(r.dev),rootFileId:String(r.ino),gitDevice:String(g.dev),gitFileId:String(g.ino)};}});
 const sources=new LocalReleaseExportSources(control),contentRoot=f.content.dataRoot,storage={request:(m,i)=>f.call(m,i)},content=()=>new LocalContentStore(storage,contentRoot,0);
 // candidateFixture deliberately registered this known original input without
 // materializing bytes. Supply those same bytes for full delivery export tests.
 await content().putBytes(meta(),{kind:'content'},Buffer.from('用户需求原文'),'text/plain; charset=utf-8');
 return {...f,storage,exportRoot:root,sourceBytes,checkout,sourceManifest:manifest,sources,exportContent:content,crash:()=>f.storage.terminate(),
  create:()=>f.call('createReleaseExport',{meta:meta(f.publication.releaseId),releaseId:f.publication.releaseId,format:'zip'}),
  exporter:()=>new ReleaseExporter(content(),sources),
 };
}
