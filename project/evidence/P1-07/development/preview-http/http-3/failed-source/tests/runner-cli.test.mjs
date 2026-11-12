import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {request} from './fixtures/runner.mjs';
import {processTestTimeoutMs} from './fixtures/process.mjs';
test('built Runner CLI starts with execution disabled and disposes HTTP/Worker without Docker',{timeout:processTestTimeoutMs},async t=>{
 const root=await mkdtemp(join(tmpdir(),'devmesh-runner-cli-')),path=join(root,'config.json');await writeFile(path,JSON.stringify({runnerId:'runner.cli',dataRoot:join(root,'runner'),controlDataRoot:join(root,'control'),backupRoot:join(root,'backup'),port:0,executionEnabled:false,identities:[{controllerId:'controller.local',credentialRef:'runner.local'}]}));
 const secret='test-cli-runner-service-token',child=spawn(process.execPath,[fileURLToPath(new URL('../packages/runner/dist/main.mjs',import.meta.url)),'--config',path,'--initialize'],{stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,DEVMESH_CREDENTIAL_RUNNER_LOCAL:secret}});let output='',diagnostic='';child.stderr.on('data',c=>diagnostic+=c);const ready=Promise.withResolvers();child.stdout.on('data',c=>{output+=c;for(const line of output.split('\n')){try{const event=JSON.parse(line);if(event.event==='runner.ready')ready.resolve(event);}catch{/* Incomplete line. */}}});const exited=once(child,'exit');void exited.then(()=>ready.reject(Error('Exited before ready: '+diagnostic)));
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await exited;await rm(root,{recursive:true,force:true});});
 const event=await ready.promise;assert.equal(event.executionConfigured,false);const base='http://127.0.0.1:'+event.port;
 assert.equal((await fetch(base+'/healthz')).status,200);const response=await fetch(base+'/runner/v1/jobs',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(request())});assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'RUNNER_NOT_CONFIGURED'});child.send({type:'shutdown'});assert.equal((await exited)[0],0,diagnostic);await assert.rejects(fetch(base+'/healthz'));
});
