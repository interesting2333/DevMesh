import type {ReactNode} from 'react';

function inline(text:string):ReactNode[]{
 return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/u).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith('`')&&part.endsWith('`')?<code key={i}>{part.slice(1,-1)}</code>:part);
}

/** Bounded text formatting through React nodes; supplied HTML is always literal. */
export function ConversationText({text}:{text:string}){
 const lines=text.split('\n'),blocks:ReactNode[]=[];
 let i=0;
 while(i<lines.length){
  const line=lines[i]!;if(!line.trim()){i++;continue;}
  if(/^\s*```/u.test(line)){
   const code:string[]=[];i++;while(i<lines.length&&!/^\s*```/u.test(lines[i]!))code.push(lines[i++]!);if(i<lines.length)i++;
   blocks.push(<pre key={blocks.length}><code>{code.join('\n')}</code></pre>);continue;
  }
  const heading=/^#{1,6}\s+(.+)$/u.exec(line);if(heading){blocks.push(<h3 key={blocks.length}>{inline(heading[1]!)}</h3>);i++;continue;}
  if(line.includes('|')&&/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u.test(lines[i+1]??'')){
   const cells=(row:string)=>row.trim().replace(/^\||\|$/g,'').split('|').slice(0,32).map(c=>c.trim()),head=cells(line),rows:string[][]=[];i+=2;
   while(i<lines.length&&lines[i]!.trim()&&lines[i]!.includes('|')&&rows.length<200)rows.push(cells(lines[i++]!));
   blocks.push(<div className="chat-table-scroll" key={blocks.length}><table><thead><tr>{head.map((cell,j)=><th key={j}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row,j)=><tr key={j}>{head.map((_,k)=><td key={k}>{inline(row[k]??'')}</td>)}</tr>)}</tbody></table></div>);continue;
  }
  const bullet=/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/u.exec(line);
  if(bullet){const items:ReactNode[]=[],ordered=/^\s*\d+[.)]/u.test(line);while(i<lines.length){const match=/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/u.exec(lines[i]!);if(!match)break;items.push(<li key={items.length}>{inline(match[1]!)}</li>);i++;}blocks.push(ordered?<ol key={blocks.length}>{items}</ol>:<ul key={blocks.length}>{items}</ul>);continue;}
  const paragraph=[line];i++;while(i<lines.length&&lines[i]!.trim()&&!/^\s*(?:```|#{1,6}\s|[-*•]\s|\d+[.)]\s)/u.test(lines[i]!))paragraph.push(lines[i++]!);
  blocks.push(<p key={blocks.length}>{inline(paragraph.join('\n'))}</p>);
 }
 return <div className="chat-text">{blocks}</div>;
}
