import {z} from 'zod';
import {gitCommit,ids,opaqueKey,sha256} from '@devmesh/contracts';
import {candidateSubjectFields,validCandidateSubject} from './candidate-protocol.js';
import {gitDirectoryIdentity,sourceManifest} from './workspace-protocol.js';
import type {CandidateBasis} from './candidate-basis.js';
import type {GitDirectoryIdentity,SourceManifest} from './workspace-protocol.js';

const original={principalId:opaqueKey,operationId:ids.operation};
const bound={...original,requestHash:sha256};
const step={...bound,ordinal:z.number().int().min(0).max(29)};
const refProof=z.strictObject({ref:z.string().min(1).max(256),commit:gitCommit});
const acknowledgement=z.strictObject({repositoryIdentity:gitDirectoryIdentity,refs:z.array(refProof).min(2).max(3),manifestSha256:sha256});
export const candidateIntegrationRequests={
 beginCandidateIntegration:z.strictObject({...candidateSubjectFields,operationId:ids.operation}).refine(validCandidateSubject),
 getCandidateIntegration:z.strictObject(original),
 getCandidateIntegrationBasis:z.strictObject(original),
 getCandidateIntegrationManifest:z.strictObject(original),
 getCandidateIntegrationStep:z.strictObject({...original,ordinal:step.ordinal}),
 beginCandidateStep:z.strictObject(step),
 prepareCandidateStep:z.strictObject({...step,bases:z.array(gitCommit).min(1).max(64),tree:gitCommit,clean:z.boolean(),reportSha256:sha256}),
 markCandidateStepSent:z.strictObject(step),
 acknowledgeCandidateStep:z.strictObject({...step,proof:z.strictObject({repositoryIdentity:gitDirectoryIdentity,commit:gitCommit,tree:gitCommit,ref:z.string().min(1).max(256)})}),
 prepareCandidateIntegration:z.strictObject({...bound,manifest:sourceManifest}),
 markCandidateIntegrationSent:z.strictObject(bound),
 acknowledgeCandidateIntegration:z.strictObject({...bound,acknowledgement}),
 failUnsentCandidateIntegration:z.strictObject({...bound,errorCode:opaqueKey}),
 recordCandidateCasRejection:z.strictObject({...bound,originalRefsAbsent:z.literal(true),gitChildExited:z.literal(true),observedHead:gitCommit.nullable()}),
 markCandidateIntegrationUncertain:z.strictObject({...bound,errorCode:opaqueKey}),
 getQualifiedCandidateSnapshot:z.strictObject(candidateSubjectFields).refine(validCandidateSubject),
};
export type CandidateIntegrationMethod=keyof typeof candidateIntegrationRequests;
export type CandidateIntegrationInput<M extends CandidateIntegrationMethod>=z.output<(typeof candidateIntegrationRequests)[M]>;
export interface CandidateHead {operationId:string;commit:string}
export interface CandidateRefUpdate {ref:string;commit:string;expected:string|null}
export interface CandidateIntegration {
 operationId:string;projectId:string;runId:string;principalId:string;purpose:'run-candidate'|'work-input';workId:string|null;
 requestHash:string;basisSha256:string;expectedHead:CandidateHead|null;sourceCount:number;acknowledgedSteps:number;
 state:'BUILDING'|'PREPARED'|'CAS_SENT'|'ACKNOWLEDGED'|'CONFLICT_PENDING'|'CONFLICT'|'FAILED';
 manifest:{commit:string;tree:string;sha256:string}|null;updates:CandidateRefUpdate[];
 acknowledgement:z.output<typeof acknowledgement>|null;errorCode:string|null;createdAt:string;acknowledgedAt:string|null;
 failureProof:{originalRefsAbsent:true;gitChildExited:true;observedHead:string|null}|null;
}
export interface CandidateIntegrationStep {
 operationId:string;ordinal:number;ours:string;theirs:string;
 state:'COMPUTING'|'PREPARED'|'REF_SENT'|'ACKNOWLEDGED'|'CONFLICT_PENDING'|'CONFLICT'|'ABANDONED';
 preparation:{bases:string[];tree:string;clean:boolean;reportSha256:string;commit:string|null;commitBody:string|null;ref:string|null}|null;
 acknowledgement:{repositoryIdentity:GitDirectoryIdentity;commit:string;tree:string;ref:string}|null;
 createdAt:string;acknowledgedAt:string|null;
}
export interface CandidateIntegrationResults {
 beginCandidateIntegration:CandidateIntegration&{created:boolean};getCandidateIntegration:CandidateIntegration;
 getCandidateIntegrationBasis:CandidateBasis;getCandidateIntegrationManifest:SourceManifest|null;getCandidateIntegrationStep:CandidateIntegrationStep|null;
 beginCandidateStep:CandidateIntegrationStep&{created:boolean};prepareCandidateStep:CandidateIntegrationStep;
 markCandidateStepSent:CandidateIntegrationStep&{send:boolean};acknowledgeCandidateStep:CandidateIntegrationStep;
 prepareCandidateIntegration:CandidateIntegration;markCandidateIntegrationSent:CandidateIntegration&{send:boolean};acknowledgeCandidateIntegration:CandidateIntegration;
 failUnsentCandidateIntegration:CandidateIntegration;recordCandidateCasRejection:CandidateIntegration;markCandidateIntegrationUncertain:CandidateIntegration;
 getQualifiedCandidateSnapshot:CandidateIntegration;
}
