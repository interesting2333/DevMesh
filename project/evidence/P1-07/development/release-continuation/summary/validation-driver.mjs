import fs from 'node:fs';
const root='.cache/p124-evidence';
for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.json')&&f!=='final-binding.json')){
 const r=JSON.parse(fs.readFileSync(root+'/'+f,'utf8'));if(!r.name)continue;
 const log=fs.readFileSync(root+'/'+f.replace(/\.json$/,'.stdout.log'),'utf8');
 console.log(JSON.stringify({file:f,name:r.name,code:r.code,signal:r.signal,tests:log.match(/^# tests (\d+)$/m)?.[1],pass:log.match(/^# pass (\d+)$/m)?.[1],fail:log.match(/^# fail (\d+)$/m)?.[1],skipped:log.match(/^# skipped (\d+)$/m)?.[1],changes:r.changedDuringRun}));
}
