export interface ZipFile {path:string;bytes:Uint8Array;mode?:'100644'|'100755'}
export class ExportError extends Error {constructor(readonly code:string){super(code);}}
export const exportLimits=Object.freeze({entries:20000,entryBytes:64*1024*1024,archiveBytes:200*1024*1024});
export function exportPath(path:string){
 if(path.length>2048||path!==path.normalize('NFC')||[...path].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)||path.includes('\\')||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..'||/[:<>"|?*]/.test(p)||/[. ]$/.test(p)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw new ExportError('EXPORT_PATH_INVALID');
 return path;
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]!^(crc>>>8);return (crc^0xffffffff)>>>0;}
/** Deterministic ZIP32 STORE: no extraction, compression, symlinks or execution. */
export function buildExportZip(input:readonly ZipFile[]):Buffer {
 if(input.length>exportLimits.entries)throw new ExportError('EXPORT_LIMIT_EXCEEDED');
 const files=[...input].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),seen=new Set<string>();let offset=0,total=22;
 for(const f of files){exportPath(f.path);const key=f.path.toLowerCase();if(seen.has(key))throw new ExportError('EXPORT_PATH_COLLISION');seen.add(key);if(f.bytes.byteLength>exportLimits.entryBytes)throw new ExportError('EXPORT_LIMIT_EXCEEDED');total+=Buffer.byteLength(f.path)*2+76+f.bytes.byteLength;if(total>exportLimits.archiveBytes)throw new ExportError('EXPORT_LIMIT_EXCEEDED');}
 for(const f of files){const parts=f.path.toLowerCase().split('/');parts.pop();while(parts.length){if(seen.has(parts.join('/')))throw new ExportError('EXPORT_PATH_COLLISION');parts.pop();}}
 const locals:Buffer[]=[],central:Buffer[]=[];
 for(const f of files){const name=Buffer.from(f.path),body=Buffer.from(f.bytes),crc=crc32(body),local=Buffer.alloc(30),entry=Buffer.alloc(46);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(name.length,26);
  entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(0x0314,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(33,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(body.length,20);entry.writeUInt32LE(body.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(((f.mode==='100755'?0o100755:0o100644)*65536)>>>0,38);entry.writeUInt32LE(offset,42);locals.push(local,name,body);central.push(entry,name);offset+=local.length+name.length+body.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,directory,end],total);
}
