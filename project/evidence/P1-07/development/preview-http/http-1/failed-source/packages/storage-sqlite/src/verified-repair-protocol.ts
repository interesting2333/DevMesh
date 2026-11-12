import {z} from 'zod';
import {ids,opaqueKey,revision,sha256,workRevision} from '@devmesh/contracts';
import type {Draft} from '@devmesh/contracts';
import type {CarriedResult} from './plan-results.js';
export const verifiedRepairTarget={operationId:ids.operation};
export const verifiedRepairRequests={
 prepareVerifiedRepair:z.strictObject({principalId:opaqueKey,operationId:ids.operation,runId:ids.run,sourceAttemptId:ids.attempt,issueIds:z.array(opaqueKey).min(1).max(50),writeScope:workRevision.shape.writeScope,planRevision:revision,requirementRevision:revision,reviewHash:sha256,changeImpact:z.enum(['implementation-only','requirements','interfaces'])}),
 getVerifiedRepair:z.strictObject({principalId:opaqueKey,operationId:ids.operation}),
 listVerifiedRepairs:z.strictObject({principalId:opaqueKey,runId:ids.run}),
};
export const verifiedRepairPublish=z.strictObject({meta:z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()}),runId:ids.run,operationId:ids.operation});
export type VerifiedRepairMethod=keyof typeof verifiedRepairRequests;
export type VerifiedRepairInput<M extends VerifiedRepairMethod>=z.output<(typeof verifiedRepairRequests)[M]>;
export interface VerifiedRepair {
 operationId:string;principalId:string;runId:string;state:'PREPARED'|'READY'|'PUBLISHED';qualification:'CURRENT'|'STALE';
 round:number;planRevision:number;requirementRevision:number;fixWorkId:string;verificationWorkId:string;
 plan:Draft;carriedResults:CarriedResult[];carryForwardHash:string;expectedHash:string;byteSize:number;writeKey:string;publishKey:string;contentHash:string|null;
}
export interface VerifiedRepairResults {prepareVerifiedRepair:VerifiedRepair;getVerifiedRepair:VerifiedRepair;listVerifiedRepairs:VerifiedRepair[]}
