import {z} from 'zod';
import {ids,revision,timestamp} from './primitives.js';
const secureOrigin=z.url().refine(value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.origin===value;}catch{return false;}},{message:'Expected canonical HTTPS origin'});
export const releaseAccessInput=z.strictObject({});
export const releaseAccessTicket=z.strictObject({ticket:z.string().regex(/^dmr_ticket\.[A-Za-z0-9_-]{43}$/),releaseOrigin:secureOrigin,expiresAt:timestamp,sessionExpiresAt:timestamp});
export const releaseEntryView=z.strictObject({
 release:z.strictObject({releaseId:ids.release,runId:ids.run,candidateId:ids.candidate,datasetId:ids.dataset,revision,state:z.enum(['PENDING','SENT','UNKNOWN','PUBLISHED']),isCurrentAccepted:z.boolean(),publishedAt:timestamp.nullable()}),
 access:z.strictObject({state:z.enum(['AVAILABLE','NOT_CONFIGURED','RECOVERING','NOT_CURRENT']),canWrite:z.boolean(),releaseOrigin:secureOrigin.nullable(),checkedAt:timestamp.nullable()}),
}).superRefine((v,ctx)=>{if((v.access.state==='AVAILABLE')!==(v.access.releaseOrigin!==null)||(v.access.state==='AVAILABLE')!==(v.access.checkedAt!==null)||v.access.canWrite&&v.access.state!=='AVAILABLE'||v.access.state==='AVAILABLE'&&(!v.release.isCurrentAccepted||v.release.state!=='PUBLISHED'))ctx.addIssue({code:'custom',message:'Available access requires current published identity and a live check'});});
export type ReleaseEntryView=z.output<typeof releaseEntryView>;
