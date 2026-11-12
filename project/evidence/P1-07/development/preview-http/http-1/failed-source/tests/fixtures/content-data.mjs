import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { openLocalStorage,LocalContentStore,SessionStore } from '../../packages/blob-store/dist/index.mjs';
import { requirements,plan,admission,meta } from './storage-data.mjs';
export { meta } from './storage-data.mjs';
export const currentSchemaVersion=JSON.parse(readFileSync(new URL('../../packages/storage-sqlite/migrations/manifest.json',import.meta.url),'utf8')).at(-1).version;
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function contentFixture(t){
  const root=mkdtempSync(join(tmpdir(),'devmesh-content-test-'));
  const options={dataRoot:join(root,'control'),backupRoot:join(root,'backups'),runnerDataRoot:join(root,'runner'),minimumFreeBytes:0};
  let local=await openLocalStorage({...options,initialize:true});
  const opened=[local];
  const f={root,options,local,storage:local.storage,content:new LocalContentStore(local.storage,local.dataRoot,0)};
  f.sessions=new SessionStore(f.content);
  f.reopen=async(extra={})=>{local=await openLocalStorage({...options,...extra});opened.push(local);f.local=local;f.storage=local.storage;f.content=new LocalContentStore(local.storage,local.dataRoot,0);f.sessions=new SessionStore(f.content);return f;};
  t.after(async()=>{for(const instance of opened)await instance.close();rmSync(root,{recursive:true,force:true});});
  return f;
}
export async function createSession(f){
  const original=await f.content.putText(meta(),{kind:'content'},'任务看板需求');
  const receipt=await f.storage.request('createProjectWithRun',{meta:meta(),name:'会话测试',baseCommit:'b'.repeat(40),contentHash:original.expectedHash,clientMessageId:randomUUID()});
  const p=receipt.result,draft=plan(),req=requirements();
  const content=await f.content.putJson(meta(),{kind:'content'},draft);
  const publication=await f.storage.request('publishPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',requirementRevision:1,planRevision:1,requirements:req,plan:draft,planContentHash:content.expectedHash});
  await f.storage.request('confirmPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r2"',requirementRevision:1,planRevision:1,reviewHash:publication.result.reviewHash});
  const ctx={...p,draft,requirements:req};
  const admitted=await f.storage.request('admitWorks',await admission(f.storage,ctx));
  const attemptId=admitted.result.attemptIds[0],session=await f.sessions.ensure('user_1',p.runId,attemptId);
  return {...ctx,attemptId,sessionId:session.sessionId,session,activationId:'activation_content_test'};
}
export const messageTarget=(ctx,clientMessageId='message.original')=>({kind:'message',sessionId:ctx.sessionId,clientMessageId,activationId:ctx.activationId,messageKind:'user'});
