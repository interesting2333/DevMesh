import {z} from 'zod';
import {ids,revision,timestamp} from './primitives.js';
const secureOrigin=z.url().refine(value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.origin===value;}catch{return false;}},{message:'Expected canonical HTTPS origin'});
export const previewAccessInput=z.strictObject({});
export const previewAccessTicket=z.strictObject({ticket:z.string().regex(/^dmp_ticket\.[A-Za-z0-9_-]{43}$/),previewOrigin:secureOrigin,expiresAt:timestamp,sessionExpiresAt:timestamp});
export const previewEntryView=z.strictObject({
  preview:z.strictObject({previewId:ids.preview,runId:ids.run,candidateId:ids.candidate,datasetId:ids.dataset,revision,state:z.enum(['STARTING','READY','STOPPING','STOPPED','EXPIRED','UNKNOWN']),expiresAt:timestamp,healthState:z.enum(['HEALTHY','UNHEALTHY','CREATED','EXITED','REMOVED','UNKNOWN']),healthCheckedAt:timestamp.nullable()}),
  access:z.strictObject({state:z.enum(['AVAILABLE','NOT_CONFIGURED','RECOVERING','STARTING','STOPPING','STOPPED','EXPIRED','UNKNOWN']),canWrite:z.boolean(),previewOrigin:secureOrigin.nullable()}),
}).superRefine((value,ctx)=>{if((value.access.state==='AVAILABLE')!==(value.access.previewOrigin!==null)||value.access.canWrite&&value.access.state!=='AVAILABLE')ctx.addIssue({code:'custom',message:'Only available access has a preview origin or write authority'});});
export type PreviewEntryView=z.output<typeof previewEntryView>;
