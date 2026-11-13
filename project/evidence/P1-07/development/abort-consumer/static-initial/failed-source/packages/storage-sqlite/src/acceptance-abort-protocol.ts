import {z} from 'zod';
import {ids,opaqueKey,sha256,revision,counter} from '@devmesh/contracts';
import {acceptancePreparationRequest} from './acceptance-protocol.js';
import type {AcceptancePreparation} from './acceptance-protocol.js';
import {canonical} from './json.js';
import {digest} from './migrations.js';

/** A durable decision to stop preparation. Cleanup and fence release are separate facts. */
export const acceptanceAbortDecision=z.strictObject({
  schemaVersion:z.literal('devmesh.acceptance-abort-decision.v1'),operationId:ids.operation,
  preparation:acceptancePreparationRequest,preparationRequestHash:sha256,preparationRevision:revision,
  preparedProofHash:sha256.nullable(),requestedBy:opaqueKey,reason:z.string().trim().min(1).max(2000),decidedAt:z.iso.datetime(),
}).refine(v=>digest(canonical(v.preparation))===v.preparationRequestHash,{message:'Exact original preparation required'});
export const acceptanceAbortRequests={
  listAcceptanceAbortWork:z.strictObject({principalId:opaqueKey,projectId:ids.project,policyHash:sha256,afterSequence:counter.default(0),limit:z.number().int().min(1).max(100).default(20)}),
  requestAcceptanceAbort:z.strictObject({
    meta:z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()}),
    runId:ids.run,ifMatch:z.string().optional(),preparationOperationId:ids.operation,requestHash:sha256,
    expectedPreparationRevision:revision,reason:z.string().trim().min(1).max(2000),confirmation:z.literal('ABORT_ACCEPTANCE_PREPARATION'),
  }),
  getAcceptanceAbortDecision:z.strictObject({principalId:opaqueKey,preparationOperationId:ids.operation,requestHash:sha256}),
};
export type AcceptanceAbortDecision=z.output<typeof acceptanceAbortDecision>;
export interface AcceptanceAbortRecord {decision:AcceptanceAbortDecision;decisionHash:string}
export type AcceptanceAbortMethod=keyof typeof acceptanceAbortRequests;
export type AcceptanceAbortInput<M extends AcceptanceAbortMethod>=z.output<(typeof acceptanceAbortRequests)[M]>;
export interface AcceptanceAbortResults {requestAcceptanceAbort:AcceptanceAbortRecord;getAcceptanceAbortDecision:AcceptanceAbortRecord|null;listAcceptanceAbortWork:{items:{sequence:number;preparation:AcceptancePreparation;record:AcceptanceAbortRecord}[];nextSequence:number|null}}
