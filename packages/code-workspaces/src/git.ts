import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {devNull} from 'node:os';
import {lstat,mkdir,readdir,realpath,open} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {canonicalRoot} from '@devmesh/blob-store';
import {canonical,managedSourcePath,sourceManifest as sourceManifestContract} from '@devmesh/storage-sqlite';

export class WorkspaceError extends Error {
  constructor(readonly code:string,readonly outcome:'not-sent'|'unknown'='not-sent'){super(code);this.name='WorkspaceError';}
}
function deny(code:string):never{throw new WorkspaceError(code);}
const sha=(v:string)=>/^[a-f0-9]{40}$/.test(v)?v:deny('GIT_OBJECT_INVALID');
const decode=(v:Buffer)=>new TextDecoder('utf-8',{fatal:true}).decode(v);
const nullFile=process.platform==='win32'?'NUL':devNull;
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const safePath=(v:string)=>managedSourcePath.safeParse(v).success;
const ref=(v:string)=>/^refs\/devmesh\/[a-z0-9][a-z0-9/_.-]{0,220}$/.test(v)&&!v.includes('..')&&!v.includes('//')&&!v.endsWith('/')&&!v.endsWith('.lock')?v:deny('GIT_REF_DENIED');
const attemptRef=(attemptId:string)=>/^attempt_[A-Za-z0-9_-]{1,110}$/.test(attemptId)?'refs/heads/devmesh/'+attemptId:deny('GIT_REF_DENIED');
export type SourceEntry={path:string;mode:'100644'|'100755';objectId:string;byteSize:number;sha256:string};
export type SourceManifest={commit:string;tree:string;files:SourceEntry[];byteSize:number;sha256:string};
export type TemplateBasis={version:string;baseCommit:string;sourceCommit:string;sourcePath:string;manifest:SourceManifest};
export type GitIdentity={root:string;gitDirectory:string;commonDirectory:string;kind:'bare'|'checkout'};
export type GitRefUpdate={ref:string;commit:string;expected:string|null};

/** Only fixed operations are public. There is no caller-provided argv or URL. */
export class ControlledGit {
  private constructor(readonly identity:Readonly<GitIdentity>,readonly binary:string,readonly directories:readonly {path:string;dev:bigint;ino:bigint}[]){}
  static async initialize(root:string,kind:GitIdentity['kind'],binary='git'){
    canonicalRoot(root);await mkdir(root,{recursive:false});
    if((await readdir(root)).length)deny('GIT_DIRECTORY_NOT_EMPTY');
    await ControlledGit.run(binary,root,['init','--quiet','--object-format=sha1',...(kind==='bare'?['--bare']:[])],undefined);
    return ControlledGit.open(root,kind,binary);
  }
  static async open(root:string,kind:GitIdentity['kind'],binary='git'){
    canonicalRoot(root);if(!binary||binary.includes('\0'))deny('GIT_CONFIGURATION_INVALID');
    const physical=await realpath(root),values=decode((await ControlledGit.run(binary,physical,['rev-parse','--show-object-format','--absolute-git-dir','--git-common-dir','--is-bare-repository'],undefined)).out).trim().split('\n');
    const [format,gitDirectory,commonDirectory,bare]=values;
    if(format!=='sha1'||!gitDirectory||!commonDirectory||bare!==(kind==='bare'?'true':'false'))deny('GIT_CONFIGURATION_INVALID');
    const git=await realpath(gitDirectory!),common=await realpath(resolve(physical,commonDirectory!));
    if(git!==common||git!==(kind==='bare'?physical:await realpath(join(physical,'.git'))))deny('GIT_SHARED_DIRECTORY_DENIED');
    const directories=await Promise.all([...new Set([physical,git,common])].map(async path=>{const stat=await lstat(path,{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink())deny('GIT_DIRECTORY_CHANGED');return Object.freeze({path,dev:stat.dev,ino:stat.ino});}));
    const provider=new ControlledGit(Object.freeze({root:physical,gitDirectory:git,commonDirectory:common,kind}),binary,Object.freeze(directories));
    await provider.validate();return provider;
  }
  private static run(binary:string,root:string,args:string[],signal:AbortSignal|undefined,input?:Buffer,maxBytes=16*1024*1024,allowFailure=false):Promise<{code:number;out:Buffer}>{
    if(signal?.aborted)throw new WorkspaceError('GIT_ABORTED');
    const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('GIT_')));
    Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:nullFile,GIT_ATTR_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_LITERAL_PATHSPECS:'1',LC_ALL:'C'});
    return new Promise((resolve,reject)=>{
      const child=spawn(binary,['--no-replace-objects','--literal-pathspecs','-c','core.hooksPath='+nullFile,'-c','core.fsmonitor=false','-c','core.attributesFile='+nullFile,'-c','core.autocrlf=false','-c','core.fsync=all','-c','core.fsyncMethod=fsync','-c','commit.gpgSign=false','-c','protocol.allow=never',...args],{cwd:root,env,windowsHide:true,stdio:['pipe','pipe','pipe'],...(signal?{signal}:{})});
      const chunks:Buffer[]=[];let bytes=0,overflow=false,ioFailure=false;
      const timer=setTimeout(()=>{overflow=true;child.kill();},30000);timer.unref();
      child.stdout.on('data',(part:Buffer)=>{bytes+=part.length;if(bytes>maxBytes){overflow=true;child.kill();}else chunks.push(part);});
      child.stderr.resume();child.stdin.on('error',()=>{});child.stdin.end(input);
      // Keep the fence until the child has closed, including an AbortError.
      child.once('error',()=>{ioFailure=true;});
      child.once('close',code=>{clearTimeout(timer);if(ioFailure)reject(new WorkspaceError('GIT_IO_UNKNOWN','unknown'));else if(overflow||code===null||code!==0&&!allowFailure)reject(new WorkspaceError('GIT_ACTION_UNKNOWN','unknown'));else resolve({code,out:Buffer.concat(chunks)});});
    });
  }
  private call(args:string[],signal?:AbortSignal,input?:Buffer,maxBytes?:number,allowFailure=false){return ControlledGit.run(this.binary,this.identity.root,args,signal,input,maxBytes,allowFailure);}
  async validate(signal?:AbortSignal){
    const b=this.identity;canonicalRoot(b.root);if(await realpath(b.root)!==b.root)deny('GIT_DIRECTORY_CHANGED');
    for(const entry of this.directories){const stat=await lstat(entry.path,{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink()||stat.dev!==entry.dev||stat.ino!==entry.ino)deny('GIT_DIRECTORY_CHANGED');}
    const [format,git,common,bare]=decode((await this.call(['rev-parse','--show-object-format','--absolute-git-dir','--git-common-dir','--is-bare-repository'],signal)).out).trim().split('\n');
    if(format!=='sha1'||!git||!common||await realpath(git)!==b.gitDirectory||await realpath(resolve(b.root,common))!==b.commonDirectory||bare!==(b.kind==='bare'?'true':'false'))deny('GIT_DIRECTORY_CHANGED');
    if(b.kind==='checkout'&&await realpath(decode((await this.call(['rev-parse','--show-toplevel'],signal)).out).trim())!==b.root)deny('GIT_DIRECTORY_CHANGED');
    if((await this.call(['config','--get-regexp','^(filter|merge)\\.'],signal,undefined,undefined,true)).code!==1)deny('GIT_HELPER_DENIED');
    for(const name of ['alternates','http-alternates'])try{await lstat(join(b.gitDirectory,'objects/info',name));deny('GIT_ALTERNATES_DENIED');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  }
  async commit(commit:string,signal?:AbortSignal){
    sha(commit);await this.validate(signal);const bytes=(await this.call(['cat-file','commit',commit],signal,undefined,1024*1024)).out;
    if(createHash('sha1').update(Buffer.from('commit '+bytes.length+'\0')).update(bytes).digest('hex')!==commit)deny('GIT_COMMIT_INVALID');
    const body=decode(bytes),headers=body.split('\n\n',1)[0]!.split('\n'),tree=headers[0]?.slice(5);
    if(!body.startsWith('tree ')||!tree)deny('GIT_COMMIT_INVALID');return {commit,tree:sha(tree!),parents:headers.filter(v=>v.startsWith('parent ')).map(v=>sha(v.slice(7))),body};
  }
  async readBlob(objectId:string,signal?:AbortSignal){sha(objectId);await this.validate(signal);return (await this.call(['cat-file','blob',objectId],signal,undefined,2*1024*1024)).out;}
  async treeEntries(commit:string,signal?:AbortSignal,contextOnly=false){
    const info=await this.commit(commit,signal),rows=decode((await this.call(['ls-tree','-r','-t','-z',info.tree],signal)).out).split('\0').filter(Boolean);
    if(rows.length>8000)deny('GIT_SOURCE_TOO_LARGE');
    // Read-only context may omit disallowed names; execution manifests remain strict.
    const entries=rows.filter(row=>{const m=/^(100644|100755|040000) (blob|tree) ([a-f0-9]{40})\t(.+)$/.exec(row),valid=m&&safePath(m[4]!)&&(m[1]==='040000')===(m[2]==='tree');if(!valid&&!contextOnly)deny('GIT_SOURCE_PATH_DENIED');return valid;}).map(row=>{const m=/^(100644|100755|040000) (blob|tree) ([a-f0-9]{40})\t(.+)$/.exec(row)!;return m[1]==='040000'?{path:m[4]!,kind:'DIRECTORY' as const,mode:'040000' as const,objectId:m[3]!}:{path:m[4]!,kind:'FILE' as const,mode:m[1] as '100644'|'100755',objectId:m[3]!};});
    if(new Set(entries.map(entry=>entry.path.toLowerCase())).size!==entries.length)deny('GIT_SOURCE_PATH_COLLISION');return entries;
  }

  async manifest(commit:string,signal?:AbortSignal):Promise<SourceManifest>{
    const info=await this.commit(commit,signal),tree=await this.treeManifest(info.tree,signal),basis={commit,tree:info.tree,files:tree.files,byteSize:tree.byteSize};if(Buffer.byteLength(canonical(basis))>192*1024)deny('GIT_SOURCE_MANIFEST_TOO_LARGE');return {...basis,sha256:hash(canonical(basis))};
  }
  private async treeManifest(tree:string,signal?:AbortSignal){
    const rows=decode((await this.call(['ls-tree','-r','-z',sha(tree)],signal)).out).split('\0').filter(Boolean);
    if(rows.length>2000)deny('GIT_SOURCE_TOO_LARGE');
    const items=rows.map(row=>{const m=/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(row);if(!m||!safePath(m[3]!))deny('GIT_SOURCE_PATH_DENIED');return {path:m![3]!,mode:m![1] as SourceEntry['mode'],objectId:m![2]!};});
    if(new Set(items.map(v=>v.path.toLowerCase())).size!==items.length)deny('GIT_SOURCE_PATH_COLLISION');
    const data=(await this.call(['cat-file','--batch'],signal,Buffer.from(items.map(v=>v.objectId+'\n').join('')),12*1024*1024)).out;
    let cursor=0,total=0;const files:SourceEntry[]=[];
    for(const item of items){const end=data.indexOf(10,cursor);if(end<cursor)deny('GIT_SOURCE_INVALID');const header=decode(data.subarray(cursor,end)),m=/^([a-f0-9]{40}) blob (\d+)$/.exec(header);if(!m||m[1]!==item.objectId)deny('GIT_SOURCE_INVALID');const size=Number(m![2]);if(!Number.isSafeInteger(size)||size>2*1024*1024)deny('GIT_SOURCE_TOO_LARGE');total+=size;if(total>8*1024*1024)deny('GIT_SOURCE_TOO_LARGE');const start=end+1,content=data.subarray(start,start+size);if(content.length!==size||data[start+size]!==10)deny('GIT_SOURCE_INVALID');files.push({...item,byteSize:size,sha256:hash(content)});cursor=start+size+1;}
    if(cursor!==data.length)deny('GIT_SOURCE_INVALID');
    const basis={tree,files,byteSize:total};return {...basis,sha256:hash(canonical(basis))};
  }
  async createTemplateBaseline(source:ControlledGit,sourceCommit:string,sourcePath:string,version:string,signal?:AbortSignal):Promise<TemplateBasis>{
    if(this.identity.kind!=='bare'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)||!sourcePath.split('/').every(p=>/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(p)))deny('GIT_TEMPLATE_CONFIGURATION_INVALID');
    await source.commit(sourceCommit,signal);await this.validate(signal);
    const tree=sha(decode((await source.call(['rev-parse','--verify',sourceCommit+':'+sourcePath],signal)).out).trim()),expected=await source.treeManifest(tree,signal);
    const pack=(await source.call(['pack-objects','--stdout','--revs','--no-reuse-delta','--no-reuse-object'],signal,Buffer.from(tree+'\n'),64*1024*1024)).out;
    await this.call(['index-pack','--stdin','--strict'],signal,pack);
    if((await this.treeManifest(tree,signal)).sha256!==expected.sha256)deny('GIT_TEMPLATE_SOURCE_CHANGED');
    // Canonical template metadata is deliberate so the same source has one basis SHA.
    const identity='DevMesh <devmesh@localhost> 946684800 +0000',body=`tree ${tree}\nauthor ${identity}\ncommitter ${identity}\n\nDevMesh template ${version}\nSource: ${sourceCommit}:${sourcePath}\n`,commit=createHash('sha1').update(Buffer.from('commit '+Buffer.byteLength(body)+'\0')).update(body).digest('hex');
    const actual=sha(decode((await this.call(['hash-object','-t','commit','-w','--stdin'],signal,Buffer.from(body))).out).trim());if(actual!==commit)deny('GIT_TEMPLATE_SOURCE_CHANGED');
    const name='refs/devmesh/templates/'+version,existing=await this.readRef(name,signal);
    if(existing!==commit&&(existing!==null||!await this.updateRefs([{ref:name,commit,expected:null}],signal)))deny('GIT_TEMPLATE_VERSION_CHANGED');
    return {version,baseCommit:commit,sourceCommit,sourcePath,manifest:await this.manifest(commit,signal)};
  }
  async changedPaths(base:string,commit:string,signal?:AbortSignal){sha(base);sha(commit);await this.validate(signal);const result=decode((await this.call(['diff-tree','--no-commit-id','--name-only','-r','-z','--no-renames',base,commit,'--'],signal)).out).split('\0').filter(Boolean);if(result.length>2000||result.some(p=>!safePath(p)))deny('GIT_SOURCE_PATH_DENIED');return result;}
  async exportCommit(commit:string,signal?:AbortSignal){await this.manifest(commit,signal);return (await this.call(['pack-objects','--stdout','--revs','--no-reuse-delta','--no-reuse-object'],signal,Buffer.from(sha(commit)+'\n'),64*1024*1024)).out;}
  async importCommit(pack:Buffer,commit:string,signal?:AbortSignal){
    sha(commit);await this.validate(signal);if(pack.length>64*1024*1024||decode(pack.subarray(0,4))!=='PACK')deny('GIT_PACK_DENIED');
    await this.call(['index-pack','--stdin','--strict'],signal,pack);return this.manifest(commit,signal);
  }
  async checkout(commit:string,signal?:AbortSignal){
    if(this.identity.kind!=='checkout')deny('GIT_CHECKOUT_DENIED');const manifest=await this.manifest(commit,signal);
    const status=await this.call(['status','--porcelain=v1','-z','--untracked-files=all'],signal);if(status.out.length)deny('GIT_CHECKOUT_DIRTY');
    await this.call(['checkout','--quiet','--detach',sha(commit)],signal);return this.verifyCheckout(manifest,signal);
  }
  async verifyCheckout(manifest:SourceManifest,signal?:AbortSignal){
    if(this.identity.kind!=='checkout')deny('GIT_CHECKOUT_DENIED');await this.validate(signal);
    const parsed=sourceManifestContract.safeParse(manifest);if(!parsed.success)deny('GIT_SOURCE_MANIFEST_INVALID');manifest=parsed.data!;
    const {sha256,...basis}=manifest;if(sha256!==hash(canonical(basis)))deny('GIT_SOURCE_MANIFEST_INVALID');
    for(const file of manifest.files){
      if(signal?.aborted)deny('GIT_ABORTED');if(!safePath(file.path)||file.byteSize>2*1024*1024)deny('GIT_SOURCE_PATH_DENIED');
      let path=this.identity.root;const parts=file.path.split('/');
      for(const [i,part] of parts.entries()){path=join(path,part);const stat=await lstat(path,{bigint:true});
        if(stat.isSymbolicLink()||i<parts.length-1&&!stat.isDirectory()||i===parts.length-1&&(!stat.isFile()||stat.nlink!==1n||stat.size!==BigInt(file.byteSize)))deny('GIT_WORKTREE_SOURCE_CHANGED');
        if(i===parts.length-1){const handle=await open(path,'r');try{const before=await handle.stat({bigint:true});if(before.dev!==stat.dev||before.ino!==stat.ino||before.nlink!==1n)deny('GIT_WORKTREE_SOURCE_CHANGED');const bytes=Buffer.alloc(file.byteSize+1);let count=0;while(count<bytes.length){const result=await handle.read(bytes,count,bytes.length-count,null);if(!result.bytesRead)break;count+=result.bytesRead;}const after=await handle.stat({bigint:true});if(count!==file.byteSize||hash(bytes.subarray(0,count))!==file.sha256||before.mtimeNs!==after.mtimeNs||after.size!==BigInt(file.byteSize))deny('GIT_WORKTREE_SOURCE_CHANGED');}finally{await handle.close();}}
      }
    }
    return manifest;
  }
  async checkoutAttempt(commit:string,attemptId:string,signal?:AbortSignal){
    const branch=attemptRef(attemptId);await this.validate(signal);const previous=await this.call(['rev-parse','--verify',branch],signal,undefined,undefined,true);
    if(previous.code===0&&decode(previous.out).trim()!==sha(commit))deny('GIT_ATTEMPT_BRANCH_CHANGED');
    const manifest=await this.checkout(commit,signal);
    if(previous.code!==0)await this.call(['update-ref',branch,sha(commit),'0'.repeat(40)],signal);
    await this.call(['symbolic-ref','HEAD',branch],signal);await this.verifyAttemptBranch(commit,attemptId,signal);return manifest;
  }
  async verifyAttemptBranch(commit:string,attemptId:string,signal?:AbortSignal){
    if(this.identity.kind!=='checkout')deny('GIT_CHECKOUT_DENIED');const branch=attemptRef(attemptId);await this.validate(signal);
    const [head,target]=await Promise.all([this.call(['symbolic-ref','--quiet','HEAD'],signal,undefined,undefined,true),this.call(['rev-parse','--verify',branch],signal,undefined,undefined,true)]);
    if(head.code!==0||target.code!==0||decode(head.out).trim()!==branch||decode(target.out).trim()!==sha(commit))deny('GIT_ATTEMPT_BRANCH_CHANGED');
  }
  async mergeBases(ours:string,theirs:string,signal?:AbortSignal){
    sha(ours);sha(theirs);await this.validate(signal);
    const inputs=await Promise.allSettled([...new Set([ours,theirs])].map(commit=>this.commit(commit,signal)));
    for(const input of inputs)if(input.status==='rejected')throw input.reason;
    const ancestors=await this.call(['merge-base','--all',ours,theirs],signal,undefined,8192,true);
    if(ancestors.code!==0)deny('GIT_MERGE_BASE_CHANGED');
    const bases=decode(ancestors.out).trim().split('\n').map(sha).sort();
    if(!bases.length||bases.length>64||new Set(bases).size!==bases.length)deny('GIT_MERGE_BASE_CHANGED');
    const facts=await Promise.allSettled(bases.map(commit=>this.commit(commit,signal)));
    for(const fact of facts)if(fact.status==='rejected')throw fact.reason;
    return bases;
  }
  /** Creates objects only; the caller must journal facts and fence project refs. */
  async mergeTree(expectedBase:string|readonly string[],ours:string,theirs:string,signal?:AbortSignal){
    const expected=(typeof expectedBase==='string'?[expectedBase]:[...expectedBase]).map(sha).sort();
    if(!expected.length||expected.length>64||new Set(expected).size!==expected.length)deny('GIT_MERGE_BASE_CHANGED');
    const bases=await this.mergeBases(ours,theirs,signal);
    if(canonical(bases)!==canonical(expected))deny('GIT_MERGE_BASE_CHANGED');
    const result=await this.call(['merge-tree','--write-tree','-z','--messages',ours,theirs],signal,undefined,1024*1024,true);
    if(result.code!==0&&result.code!==1)throw new WorkspaceError('GIT_MERGE_UNKNOWN','unknown');
    if(result.out.at(-1)!==0)deny('GIT_MERGE_OUTPUT_DENIED');
    const values=decode(result.out).split('\0'),tree=sha(values.shift()??'');
    const stages:{path:string;mode:'100644'|'100755';objectId:string;stage:1|2|3}[]=[];
    while(values.length&&values[0]!==''){
      const match=/^(100644|100755) ([a-f0-9]{40}) ([123])\t(.+)$/.exec(values.shift()!);
      if(!match||!safePath(match[4]!)||stages.length>=6000)deny('GIT_MERGE_OUTPUT_DENIED');
      stages.push({path:match[4]!,mode:match[1] as '100644'|'100755',objectId:match[2]!,stage:Number(match[3]) as 1|2|3});
    }
    if(values.shift()!=='')deny('GIT_MERGE_OUTPUT_DENIED');
    if(new Set(stages.map(s=>s.path+'\0'+s.stage)).size!==stages.length)deny('GIT_MERGE_OUTPUT_DENIED');
    const messages:{paths:string[];kind:string;message:string}[]=[];
    while(values.length&&!(values.length===1&&values[0]==='')){
      const countText=values.shift()!,count=Number(countText);
      if(!/^[1-9][0-9]*$/.test(countText)||count>2000||count+2>values.length||messages.length>=2000)deny('GIT_MERGE_OUTPUT_DENIED');
      const paths=values.splice(0,count),kind=values.shift()!,message=values.shift()!;
      if(paths.some(p=>!safePath(p))||!kind||kind.length>256||message.length>65536)deny('GIT_MERGE_OUTPUT_DENIED');
      messages.push({paths,kind,message});
    }
    if(result.code===0&&(stages.length||messages.some(m=>m.kind.startsWith('CONFLICT'))))deny('GIT_MERGE_OUTPUT_DENIED');
    await this.treeManifest(tree,signal);
    return {clean:result.code===0,tree,base:bases.length===1?bases[0]!:null,bases,ours,theirs,stages,messages};
  }
  async writeCommit(body:string,signal?:AbortSignal){
    if(body.length>10000||body.includes('\0')||Buffer.from(body).toString('utf8')!==body)deny('GIT_COMMIT_INVALID');
    await this.validate(signal);const expected=createHash('sha1').update(Buffer.from('commit '+Buffer.byteLength(body)+'\0')).update(body).digest('hex');
    const commit=sha(decode((await this.call(['hash-object','-t','commit','-w','--stdin'],signal,Buffer.from(body),8192)).out).trim());
    if(commit!==expected)throw new WorkspaceError('GIT_COMMIT_CHANGED','unknown');
    if((await this.commit(commit,signal)).body!==body)throw new WorkspaceError('GIT_COMMIT_CHANGED','unknown');
    return commit;
  }

  async verifyPreservationBasis(base:string,expectedRefs:readonly {ref:string;commit:string}[],signal?:AbortSignal){
    sha(base);for(const item of expectedRefs){if(item.ref.startsWith('refs/heads/devmesh/'))attemptRef(item.ref.slice('refs/heads/devmesh/'.length));else ref(item.ref);sha(item.commit);}if(this.identity.kind!=='checkout'||expectedRefs.length>66||new Set(expectedRefs.map(item=>item.ref)).size!==expectedRefs.length)deny('GIT_PRESERVATION_BASIS_INVALID');await this.validate(signal);
    const listed=decode((await this.call(['for-each-ref','--format=%(refname)%00%(objectname)%00%(symref)'],signal,undefined,256*1024)).out).split('\n').filter(Boolean).map(line=>{const [name,commit,symbolic,...extra]=line.replace(/\r$/,'').split('\0');if(!name||!commit||symbolic!==''||extra.length)deny('GIT_PRESERVATION_REF_INVALID');sha(commit);return {ref:name,commit};});
    const order=(a:{ref:string},b:{ref:string})=>a.ref<b.ref?-1:a.ref>b.ref?1:0;if(canonical(listed.sort(order))!==canonical([...expectedRefs].sort(order)))deny('GIT_PRESERVATION_UNRETAINED_REF');
    const index=await this.call(['diff-index','--cached','--quiet',base,'--'],signal,undefined,undefined,true);if(index.code!==0)deny('GIT_PRESERVATION_INDEX_CHANGED');
  }
  async readRef(name:string,signal?:AbortSignal){ref(name);await this.validate(signal);const r=await this.call(['rev-parse','--verify',name],signal,undefined,undefined,true);return r.code===0?sha(decode(r.out).trim()):null;}
  async head(signal?:AbortSignal){await this.validate(signal);const r=await this.call(['rev-parse','--verify','HEAD'],signal,undefined,undefined,true);return r.code===0?sha(decode(r.out).trim()):null;}
  async branch(signal?:AbortSignal){await this.validate(signal);const r=await this.call(['symbolic-ref','--quiet','--short','HEAD'],signal,undefined,undefined,true);return r.code===0?decode(r.out).trim():'分离 HEAD';}
  async updateRefs(updates:readonly GitRefUpdate[],signal?:AbortSignal){
    if(!updates.length||updates.length>8||new Set(updates.map(u=>u.ref)).size!==updates.length)deny('GIT_REF_DENIED');await this.validate(signal);
    const input='start\n'+updates.map(u=>'update '+ref(u.ref)+' '+sha(u.commit)+' '+(u.expected===null?'0'.repeat(40):sha(u.expected))+'\n').join('')+'prepare\ncommit\n';
    return (await this.call(['update-ref','--stdin'],signal,Buffer.from(input),undefined,true)).code===0;
  }
}
