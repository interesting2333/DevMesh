import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),entries=[];
for(const pkg of ['contracts','storage-sqlite','runner','platform-core','preview-gateway','input-api']){
 const dir='packages/'+pkg+'/dist';for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.map'))){const file=dir+'/'+name,m=JSON.parse(fs.readFileSync(file,'utf8'));for(let i=0;i<m.sources.length;i++){const src=path.resolve(path.dirname(file),m.sourceRoot??'',m.sources[i]);if(!fs.existsSync(src)||m.sourcesContent?.[i]===null||m.sourcesContent?.[i]===undefined)throw Error('Unresolved map source '+src);const b=fs.readFileSync(src);if(!b.equals(Buffer.from(m.sourcesContent[i])))throw Error('Source map drift '+src);entries.push({source:path.relative(process.cwd(),src).replaceAll('\\','/'),sha256:sha(b),map:file,mapSha256:sha(fs.readFileSync(file))});}}
}
fs.writeFileSync('.cache/p123-evidence/maps.json',JSON.stringify({entries},null,2)+'\n');console.log(JSON.stringify({checked:entries.length}));
