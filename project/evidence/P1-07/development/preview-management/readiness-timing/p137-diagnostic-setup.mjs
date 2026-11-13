import fs from 'node:fs';
fs.writeFileSync('.cache/p137-diagnostic-driver.mjs',fs.readFileSync('.cache/p137-driver.mjs','utf8').replace('const commands={',"const commands={readiness:['node',['--test','--test-concurrency=1','--test-reporter=tap','.cache/p137-readiness-diagnostic.mjs']],"));
fs.mkdirSync('.cache/p137-evidence/readiness-timing',{recursive:true});for(const name of ['p137-readiness-diagnostic.mjs','p137-diagnostic-setup.mjs'])fs.copyFileSync('.cache/'+name,'.cache/p137-evidence/readiness-timing/'+name);
