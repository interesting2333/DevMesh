// 专题文件是详细设计原稿；主文整合区由此生成。主文前九章保留原样。
// node ./design/生成完整方案.mjs        更新完整主文
// node ./design/生成完整方案.mjs --check 只检查是否同步
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const designDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(designDir);
const mainPath=path.join(root,'DevMesh_技术设计方案_V1.1.md');
const begin='<!-- BEGIN: DevMesh V1.1 详细设计整合区 -->';
const end='<!-- END: DevMesh V1.1 详细设计整合区 -->';
const specs=[
  ['01_领域模型与状态机.md',10,'领域模型与状态机','D1'],
  ['02_Agent与协议详细设计.md',11,'Agent与协议详细设计','D2'],
  ['03_API与用户流程.md',12,'API与用户流程','D3'],
  ['04_执行恢复与交付.md',13,'执行恢复与交付','D4'],
  ['05_数据与事务.md',14,'数据与事务','D5'],
  ['06_验证与验收追踪.md',15,'验证与验收追踪','D6'],
];
const slug=s=>s.toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu,'').replace(/\s/g,'-');
const key=p=>path.resolve(p).toLowerCase();
const normalize=s=>s.replace(/\r\n/g,'\n');
const current=normalize(fs.readFileSync(mainPath,'utf8'));
if(current.includes(begin)!==current.includes(end))throw new Error('整合区标记不完整，拒绝覆盖。');
const overview=current.split(begin)[0].trimEnd();
const docs=specs.map(([file,chapter,title,id])=>{
  const absolute=path.join(designDir,file);
  const lines=normalize(fs.readFileSync(absolute,'utf8')).split('\n');
  const anchors=new Map();
  let fenced=false;
  const transformed=lines.map((line,index)=>{
    if(line.startsWith('```')){fenced=!fenced;return line;}
    if(fenced)return line;
    const match=/^(#{1,5}) (.+)$/.exec(line);
    if(!match)return line;
    if(index===0&&match[1]==='#'){
      anchors.set(slug(match[2]),slug(`${chapter}. ${title}`));
      return `## ${chapter}. ${title}\n\n本章对应专题 ${id}，以下收录完整正文。`;
    }
    const newTitle=/^\d/.test(match[2])?`${chapter}.${match[2]}`:`${chapter}. ${match[2]}`;
    anchors.set(slug(match[2]),slug(newTitle));
    return `${match[1]}# ${newTitle}`;
  });
  return {absolute,chapter,title,id,anchors,lines:transformed};
});
const byPath=new Map(docs.map(doc=>[key(doc.absolute),doc]));
const sections=docs.map(doc=>{
  let fenced=false;
  return doc.lines.map(line=>{
    if(line.startsWith('```')){fenced=!fenced;return line;}
    if(fenced)return line;
    return line.replace(/(!?\[[^\]]*\])\(([^)]+)\)/g,(whole,label,target)=>{
      if(/^[a-z][a-z0-9+.-]*:/i.test(target))return whole;
      const [relative,anchor]=target.split('#');
      const resolved=relative?path.resolve(path.dirname(doc.absolute),decodeURIComponent(relative)):doc.absolute;
      const linkedDoc=byPath.get(key(resolved));
      if(linkedDoc){
        const mapped=anchor?linkedDoc.anchors.get(decodeURIComponent(anchor)):slug(`${linkedDoc.chapter}. ${linkedDoc.title}`);
        if(!mapped)throw new Error(`找不到专题锚点: ${target}`);
        return `${label}(#${mapped})`;
      }
      const moved=path.relative(root,resolved).replaceAll('\\','/');
      return `${label}(${moved}${anchor?'#'+anchor:''})`;
    });
  }).join('\n').trim();
});
const expected=`${overview}\n\n${begin}\n\n${sections.join('\n\n---\n\n')}\n\n${end}\n`;
if(process.argv.includes('--check')){
  if(current!==expected){console.error('主文整合区与专题原稿不同步，请先运行生成命令。');process.exitCode=1;}
  else console.log('完整主文与六份专题正文一致。');
}else{
  fs.writeFileSync(mainPath,expected,'utf8');
  console.log(JSON.stringify({file:mainPath,chapters:15,includedTopics:docs.length,lines:expected.split('\n').length-1}));
}
