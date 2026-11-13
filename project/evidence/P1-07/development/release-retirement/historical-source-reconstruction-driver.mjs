import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {dirname} from 'node:path';import {createHash} from 'node:crypto';
const root='.cache/p1-07/release-retirement-build-01',inputs=JSON.parse(readFileSync(root+'/inputs-before.json')),sha=b=>createHash('sha256').update(b).digest('hex'),base=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files={},unchangedBaseFilesOmitted={};
for(const [file,expected] of Object.entries(inputs)){
 let original;try{original=execFileSync('git',['show',base+':'+file],{stdio:['ignore','pipe','ignore']});}catch{}
 if(original&&sha(original)===expected){unchangedBaseFilesOmitted[file]=expected;continue;}
 let bytes=readFileSync(file);
 if(sha(bytes)!==expected&&file==='packages/runner/src/release-retirement-domain.ts')bytes=Buffer.from(bytes.toString().replace("   const claim=proof.service.claim;\n   if(claim.schemaVersion!=='devmesh.acceptance-service-claim.v1')throw new RunnerError('RELEASE_RETIREMENT_ORIGINAL_UNVERIFIED',409);","   if(proof.service.claim.schemaVersion!=='devmesh.acceptance-service-claim.v1')fail('RELEASE_RETIREMENT_ORIGINAL_UNVERIFIED');").replace('requestHash:claim.serviceRequestHash','requestHash:proof.service.claim.serviceRequestHash'));
 if(sha(bytes)!==expected)throw Error('Historical input unavailable '+file);
 const dest=root+'/source-snapshot/'+file;mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,bytes);files[file]=expected;
}
writeFileSync(root+'/source-snapshot/binding.json',JSON.stringify({base,files,unchangedBaseFilesOmitted,reconstruction:'Only domain union narrowing was reversed from exact patch and verified against recorded input SHA. All unchanged files bind to parent Git objects.'},null,2)+'\n');
console.log(JSON.stringify({retained:Object.keys(files).length,baseFiles:Object.keys(unchangedBaseFilesOmitted).length}));
