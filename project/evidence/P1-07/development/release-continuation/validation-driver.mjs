import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const name=process.argv[2],commands={
 continuation:['node',['--test','--test-concurrency=1','--test-reporter=tap','tests/release-continuation.test.mjs']],
 runner:['node',['--test','--test-concurrency=1','--test-reporter=tap','tests/runner*.test.mjs']],
 build:['pnpm.cmd',['--filter','@devmesh/contracts','--filter','@devmesh/storage-sqlite','--filter','@devmesh/runner','--filter','@devmesh/platform-core','--filter','@devmesh/preview-gateway','--filter','@devmesh/input-api','-r','run','build']],
 check:['pnpm.cmd',['typecheck']],lint:['pnpm.cmd',['lint']],contracts:['node',['scripts/contracts.mjs','--check']],
 'contract-tests':['node',['--test','--test-reporter=tap','tests/contracts.test.mjs']],
 access:['node',['--test','--test-concurrency=1','--test-reporter=tap','tests/release-access.test.mjs']],
 http:['node',['--test','--test-concurrency=1','--test-reporter=tap','tests/release-http.test.mjs']],
 regression:['node',['--test','--test-concurrency=1','--test-reporter=tap','tests/release-publication.test.mjs','tests/verification-preview-http.test.mjs','tests/storage-preview-access.test.mjs','tests/storage-preview-sessions.test.mjs','tests/storage-release-publication-upgrade.test.mjs','tests/input-preview.test.mjs']],
 acceptance:['node',['--test','--test-concurrency=1','--test-reporter=tap','tests/acceptance*.test.mjs']],
 browser:['node',['--test','--test-concurrency=1','--test-reporter=tap','tests/browser/release-entry.test.mjs']],
 upgrade:['node',['--test','--test-concurrency=1','--test-reporter=tap','tests/storage-release-access-upgrade.test.mjs']],
};
if(!commands[name])throw Error('Unknown validation group');
const dir=path.resolve('.cache/p124-evidence');fs.mkdirSync(dir,{recursive:true});
const prefix=path.join(dir,name+'-'+new Date().toISOString().replaceAll(/[:.]/g,'-')),hash=b=>createHash('sha256').update(b).digest('hex');
function inventory(){const out={};function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){if(['node_modules','.git'].includes(e.name))continue;const f=path.join(p,e.name);if(e.isDirectory())walk(f);else if(/\.(ts|mjs|sql|json)$/.test(e.name))out[f.replaceAll('\\','/')]=hash(fs.readFileSync(f));}}for(const p of ['packages','tests','scripts'])walk(p);return out;}
const before=inventory(),start=new Date().toISOString(),[exe,args]=commands[name],stdout=fs.openSync(prefix+'.stdout.log','wx'),stderr=fs.openSync(prefix+'.stderr.log','wx');
const env={...process.env};if(fs.existsSync('.cache/p107-session-env.json'))Object.assign(env,JSON.parse(fs.readFileSync('.cache/p107-session-env.json','utf8')));
const child=spawn(process.platform==='win32'&&exe.endsWith('.cmd')?'cmd.exe':exe,process.platform==='win32'&&exe.endsWith('.cmd')?['/d','/s','/c',[exe,...args].join(' ')]:args,{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore',stdout,stderr]});
const result=await new Promise(resolve=>{child.once('error',e=>resolve({error:e.message}));child.once('exit',(code,signal)=>resolve({code,signal}));});fs.closeSync(stdout);fs.closeSync(stderr);
const after=inventory(),changed=Object.keys({...before,...after}).filter(p=>before[p]!==after[p]);
const record={name,command:[exe,...args],start,end:new Date().toISOString(),...result,changedDuringRun:changed,before,after,stdoutHash:hash(fs.readFileSync(prefix+'.stdout.log')),stderrHash:hash(fs.readFileSync(prefix+'.stderr.log'))};fs.writeFileSync(prefix+'.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({name,...result,changedDuringRun:changed,record:prefix+'.json'}));console.log(fs.readFileSync(prefix+'.stdout.log','utf8').slice(-6500));console.log(fs.readFileSync(prefix+'.stderr.log','utf8').slice(-3000));process.exitCode=result.code??1;
