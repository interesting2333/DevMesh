import {z} from 'zod';
import {opaqueKey,sha256,gitCommit,timestamp} from './primitives.js';
export const createReleaseExportInput=z.strictObject({format:z.literal('zip')});
export const retryReleaseExportInput=z.strictObject({expectedGeneration:z.number().int().nonnegative()});
export const releaseExportView=z.strictObject({
 exportId:opaqueKey,releaseId:opaqueKey,runId:opaqueKey,candidateId:opaqueKey,codeCommit:gitCommit,cutoffSeq:z.number().int().nonnegative(),snapshotHash:sha256,
 state:z.enum(['QUEUED','PACKING','FAILED','READY']),generation:z.number().int().nonnegative(),leaseUntil:timestamp.nullable(),
 archiveHash:sha256.nullable(),archiveSize:z.number().int().nonnegative().nullable(),errorCode:z.string().nullable(),createdAt:timestamp,updatedAt:timestamp,
}).superRefine((v,ctx)=>{if((v.archiveHash===null)!==(v.archiveSize===null)||v.state==='READY'&&v.archiveHash===null)ctx.addIssue({code:'custom',message:'Ready export requires exact archive metadata'});});
export const releaseExportListView=z.strictObject({jobs:z.array(releaseExportView).max(200),nextCursor:opaqueKey.nullable()});
