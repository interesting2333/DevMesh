import {z} from 'zod';
export const unsafeQualityPath=(v:string)=>[...v].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)||v.includes('\\')||v.includes(':');
export const qualityPath=z.string().min(1).max(512).refine(v=>!unsafeQualityPath(v)&&v.normalize('NFC')===v&&v.split('/').every(p=>p!==''&&p!=='.'&&p!=='..'&&!/[. ]$/.test(p)),'Canonical relative source path required');
