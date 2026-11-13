import {z} from 'zod';
import {opaqueKey,sha256} from '@devmesh/contracts';
import type {AcceptedRelease} from './acceptance-commit-protocol.js';
import type {GitDirectoryIdentity,SourceManifest} from './workspace-protocol.js';
const target={principalId:opaqueKey,exportId:opaqueKey};
const claim={...target,generation:z.number().int().positive(),claimToken:z.uuid()};
export const releaseExportRequests={
 createReleaseExport:z.strictObject({meta:z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()}),releaseId:opaqueKey,format:z.literal('zip')}),
 getReleaseExport:z.strictObject(target),
 getReleaseExportEntry:z.strictObject({principalId:opaqueKey,releaseId:opaqueKey}),
 listReleaseExports:z.strictObject({principalId:opaqueKey,releaseId:opaqueKey,afterExportId:opaqueKey.optional(),limit:z.number().int().min(1).max(200).default(50)}),
 // Private trusted-host scan; never mapped to a public API or an Agent tool.
 listReleaseExportWork:z.strictObject({afterExportId:opaqueKey.optional(),limit:z.number().int().min(1).max(200).default(32)}),
 retryReleaseExport:z.strictObject({...target,expectedGeneration:z.number().int().nonnegative()}),
 claimReleaseExport:z.strictObject(target),
 getReleaseExportContext:z.strictObject(claim),
 prepareReleaseExportArchive:z.strictObject({...claim,hash:sha256,byteSize:z.number().int().nonnegative().max(200*1024*1024),manifest:z.json()}),
 failReleaseExport:z.strictObject({...claim,errorCode:z.string().regex(/^[A-Z][A-Z0-9_]{0,95}$/)}),
};
export type ReleaseExportMethod=keyof typeof releaseExportRequests;
export type ReleaseExportInput<M extends ReleaseExportMethod>=z.infer<(typeof releaseExportRequests)[M]>;
export interface ReleaseExportJob {
 exportId:string;releaseId:string;runId:string;candidateId:string;codeCommit:string;cutoffSeq:number;snapshotHash:string;
 state:'QUEUED'|'PACKING'|'FAILED'|'READY';generation:number;leaseUntil:string|null;
  archiveHash:string|null;archiveSize:number|null;errorCode:string|null;createdAt:string;updatedAt:string;canRetry:boolean;
}
export interface ReleaseExportMaterial {key:string;path:string;contentHash:string;byteSize:number;transform:'EXACT'|'REDACT_JSON'}
export interface ReleaseExportSnapshot {
 schemaVersion:'devmesh.release-export-snapshot.v1';release:AcceptedRelease;candidateId:string;candidateRevision:number;
 manifestHash:string;codeCommit:string;requirementRevision:number;planRevision:number;checkConfigHash:string;templateVersion:string;cutoffSeq:number;
 source:{identity:GitDirectoryIdentity;manifest:SourceManifest};records:Record<string,unknown>;materials:ReleaseExportMaterial[];
}
export interface ReleaseExportContext {job:ReleaseExportJob;generation:number;claimToken:string;snapshot:ReleaseExportSnapshot;writeKey:string}
export interface ReleaseExportResults {
 createReleaseExport:ReleaseExportJob;getReleaseExport:ReleaseExportJob;retryReleaseExport:ReleaseExportJob;
 listReleaseExports:{jobs:ReleaseExportJob[];nextCursor:string|null};
 listReleaseExportWork:{jobs:{exportId:string;principalId:string;state:'QUEUED'|'PACKING';generation:number}[];nextCursor:string|null};
 getReleaseExportEntry:{releaseId:string;runId:string;candidateId:string;codeCommit:string;acceptedAt:string;isCurrentAccepted:boolean};
 claimReleaseExport:ReleaseExportContext|null;getReleaseExportContext:ReleaseExportContext;
 prepareReleaseExportArchive:ReleaseExportJob;failReleaseExport:ReleaseExportJob;
}
