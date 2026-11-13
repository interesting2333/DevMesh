import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='project/evidence/P1-07/development/release-access';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const staged=p=>execFileSync('git',['show',':'+p],{windowsHide:true,maxBuffer:16*1024*1024});
const binding=read(root+'/final-binding.json'),manifest=read(root+'/manifest.json');
for(const [file,hash] of Object.entries(binding.files))if(sha(fs.readFileSync(file))!==hash)throw Error('Current input drift '+file);
for(const f of manifest.files){
 if(!/\.(json|mjs|ts|log|txt)$/.test(f.file))throw Error('Unexpected evidence type '+f.file);
 const bytes=fs.readFileSync(f.file);
 if(bytes.length!==f.byteSize||sha(bytes)!==f.sha256||!bytes.equals(staged(f.file)))throw Error('Evidence bytes differ '+f.file);
}
if(!fs.readFileSync(root+'/manifest.json').equals(staged(root+'/manifest.json')))throw Error('Manifest not staged');
const paths=execFileSync('git',['diff','--cached','--name-only','-z'],{windowsHide:true}).toString().split('\0').filter(Boolean),mismatches=[];
for(const file of paths)if(!fs.readFileSync(file).equals(staged(file)))mismatches.push(file);
if(mismatches.length)throw Error('Staged bytes differ '+mismatches.join(', '));
console.log(JSON.stringify({currentInputs:Object.keys(binding.files).length,rawEvidence:manifest.files.length,stagedFiles:paths.length,allBytesExact:true}));
