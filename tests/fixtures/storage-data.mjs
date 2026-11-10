import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { openStorage } from '../../packages/storage-sqlite/dist/index.mjs';

const examples = JSON.parse(readFileSync(new URL('../../packages/contracts/examples/valid.json', import.meta.url)));
export const canonical = value => Array.isArray(value) ? '['+value.map(canonical).join(',')+']' : value && typeof value==='object' ? '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}' : JSON.stringify(value);
export const hash = value => createHash('sha256').update(value).digest('hex');
export const meta = (scopeId = 'creation.user_1') => ({ principalId: 'user_1', scopeId, idempotencyKey: randomUUID() });
export const requirements = () => structuredClone(examples.find(e=>e.schema==='ProductOutput').input);
export function plan(roles = ['developer','tester']) {
  const work = examples.find(e=>e.schema==='ArchitectOutput').input.planDraft.works[0];
  return { requirementRevision: 1, works: roles.map((role,i)=>({ ...structuredClone(work), workId: 'work_'+(i+1), role, writeScope: role==='developer'?['src/board.ts']:[] })) };
}
export async function fixture(t, extra={}) {
  const root = mkdtempSync(join(tmpdir(),'devmesh-storage-test-'));
  mkdirSync(join(root,'db')); mkdirSync(join(root,'backup')); mkdirSync(join(root,'objects'));
  const options = { databasePath: join(root,'db','devmesh.sqlite'), storeId: randomUUID(), ...extra };
  const storage = await openStorage({ ...options, create: true });
  const opened = [storage];
  t.after(async()=>{ for(const client of opened) await client.close(); rmSync(root,{recursive:true,force:true}); });
  return { root, options, storage, async reopen(extraOptions={}) { const client=await openStorage({...options,...extraOptions});opened.push(client);return client; } };
}
export async function content(storage, value, root) {
  const bytes = typeof value==='string' ? value : canonical(value), contentHash=hash(bytes);
  if(root) writeFileSync(join(root,'objects',contentHash),bytes);
  await storage.request('registerContent',{contentHash,byteSize:Buffer.byteLength(bytes),mimeType:'application/json'});
  return contentHash;
}
export async function project(storage, root, overrides={}) {
  const contentHash = await content(storage,'用户需求原文',root);
  const input={meta:meta(),name:'测试项目',baseCommit:'b'.repeat(40),contentHash,clientMessageId:randomUUID(),...overrides};
  const receipt=await storage.request('createProjectWithRun',input);
  return {input,receipt,...receipt.result};
}
export async function planned(storage, root, roles=['developer','tester']) {
  const p=await project(storage,root), draft=plan(roles), req=requirements();
  const planContentHash=await content(storage,draft,root);
  const publication=await storage.request('publishPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',requirementRevision:1,planRevision:1,requirements:req,plan:draft,planContentHash});
  await storage.request('confirmPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r2"',requirementRevision:1,planRevision:1,reviewHash:publication.result.reviewHash});
  return {...p,draft,requirements:req,publication};
}
export async function admission(storage, context, indices=[0]) {
  const run=await storage.request('getRun',{runId:context.runId});
  return {meta:meta(context.runId),runId:context.runId,ifMatch:`"r${run.resourceRevision}"`,runEpoch:run.runEpoch,planRevision:1,works:indices.map(index=>{
    const work=context.draft.works[index];
    return { workId:work.workId,workRevision:1,workEpoch:1,
      inputManifest:{schemaVersion:'devmesh.input-manifest.v1',requirements:context.requirements.requirements.map(r=>({requirementId:r.id,sha256:hash(canonical(r))})),interfaces:[],artifacts:[],codeCommit:'b'.repeat(40),templateVersion:'template.v1',checkConfigHash:'c'.repeat(64),decisionIds:[]},
      roleSnapshot:{role:work.role,revision:'v1',provider:'test.provider',model:'test.model',promptArtifactId:context.artifactId,outputSchemaId:'devmesh.result.v1',allowedTools:[],maxSteps:40,contextLimitTokens:8192,outputReserveTokens:2048,requestTimeoutMs:120000,maxReadOnlyRetries:2},
      endpoint:{endpointId:'builtin.'+work.role,revision:1,cardHash:'d'.repeat(64),registryGenerationId:'generation_01'},resources:[{kind:'workspace',resourceId:'workspace_01',access:'write'}] };
  })};
}
