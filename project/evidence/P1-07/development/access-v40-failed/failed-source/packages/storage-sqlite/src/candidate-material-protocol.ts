import {createHash} from 'node:crypto';
import {z} from 'zod';
import {gitCommit,ids,opaqueKey,sha256} from '@devmesh/contracts';
import {gitDirectoryIdentity,managedSourcePath} from './workspace-protocol.js';

const original={principalId:opaqueKey,operationId:ids.operation},step={...original,ordinal:z.number().int().min(0).max(29)},bound={...step,requestHash:sha256};
const file={path:managedSourcePath,version:z.string().regex(/^(ours|theirs|base\.[a-f0-9]{40}|stage\.[123])$/)};
export const candidateMaterialDescriptor=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('REPORT'),mergeSha256:sha256,sha256,byteSize:z.number().int().min(1).max(32*1024*1024)}),
 z.strictObject({kind:z.literal('FILE'),...file,objectId:gitCommit,mode:z.enum(['100644','100755']),sha256,byteSize:z.number().int().min(0).max(2*1024*1024)}),
 z.strictObject({kind:z.literal('DIRECTORY'),...file,objectId:gitCommit}),
 z.strictObject({kind:z.literal('ABSENT'),...file}),
]);
export type CandidateMaterialDescriptor=z.output<typeof candidateMaterialDescriptor>;
export function candidateMaterialKey(descriptor:CandidateMaterialDescriptor){return descriptor.kind==='REPORT'?'report':createHash('sha256').update(descriptor.version+'\0'+descriptor.path).digest('hex');}
export const candidateMaterialTarget={operationId:ids.operation,ordinal:step.ordinal,materialKey:z.union([z.literal('report'),sha256])};
export const candidateMaterialRequests={
 getCandidateMaterial:z.strictObject({...original,...candidateMaterialTarget}),
 declareCandidateMaterials:z.strictObject({...bound,materials:z.array(candidateMaterialDescriptor).min(1).max(100)}),
 listCandidateMaterials:z.strictObject({...step,afterKey:z.string().max(64).default(''),limit:z.number().int().min(1).max(100).default(100)}),
 sealCandidateConflictMaterials:z.strictObject({...bound,materialCount:z.number().int().min(1).max(20000),manifestSha256:sha256}),
 acknowledgeCandidateConflict:z.strictObject({...bound,proof:z.strictObject({repositoryIdentity:gitDirectoryIdentity,reportSha256:sha256,manifestSha256:sha256,materialCount:z.number().int().min(1).max(20000)})}),
};
export interface CandidateMaterial {operationId:string;ordinal:number;materialKey:string;descriptor:CandidateMaterialDescriptor;writeKey:string|null;contentHash:string|null;writeId:string|null}
export interface CandidateConflictAcknowledgement {repositoryIdentity:z.output<typeof gitDirectoryIdentity>;reportSha256:string;manifestSha256:string;materialCount:number}
export type CandidateMaterialMethod=keyof typeof candidateMaterialRequests;
export type CandidateMaterialInput<M extends CandidateMaterialMethod>=z.output<(typeof candidateMaterialRequests)[M]>;
export interface CandidateMaterialResults {getCandidateMaterial:CandidateMaterial|null;declareCandidateMaterials:CandidateMaterial[];listCandidateMaterials:CandidateMaterial[];sealCandidateConflictMaterials:{manifestSha256:string;materialCount:number};acknowledgeCandidateConflict:{operationId:string;state:'CONFLICT';acknowledgement:CandidateConflictAcknowledgement}}

export const candidateMergeReport=z.strictObject({clean:z.boolean(),tree:gitCommit,base:gitCommit.nullable(),bases:z.array(gitCommit).min(1).max(64),ours:gitCommit,theirs:gitCommit,stages:z.array(z.strictObject({path:managedSourcePath,mode:z.enum(['100644','100755']),objectId:gitCommit,stage:z.union([z.literal(1),z.literal(2),z.literal(3)])})).max(6000),messages:z.array(z.strictObject({paths:z.array(managedSourcePath).min(1).max(2000),kind:z.string().min(1).max(256),message:z.string().max(65536)})).max(2000)});
export const candidateReportEnvelope=z.strictObject({schemaVersion:z.literal('devmesh.candidate-report.v1'),merge:candidateMergeReport,virtualBaseBlobs:z.array(z.strictObject({objectId:gitCommit,base64:z.string().max(3*1024*1024).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)})).max(2000)});
