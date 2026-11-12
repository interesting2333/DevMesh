import { z } from 'zod';
import { ids, opaqueKey, sha256, timestamp } from '@devmesh/contracts';
export const previewAccessPolicy = z.strictObject({ schemaVersion: z.literal('devmesh.preview-access-policy.v1'), gatewayId: opaqueKey, gatewayPrincipalId: opaqueKey, configurationHash: sha256 });
const gateway = { principalId: opaqueKey, gatewayId: opaqueKey, configurationHash: sha256 };
const target = { subjectPrincipalId: opaqueKey, runId: ids.run, previewId: ids.preview };
const original = { ...gateway, accessRequestId: opaqueKey, requestHash: sha256 };
const dataset = { principalId: opaqueKey, datasetOperationId: ids.operation, datasetRequestHash: sha256 };
const requestPath = z.string().max(8192).refine(path => path.startsWith('/') && !path.startsWith('//') && !/[\\#]/.test(path) && !/%(?:0[ad]|5c)/i.test(path) && ![...path].some(c => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127));
export const previewAccessHttpRequest = z.strictObject({ method: z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']), path: requestPath, bodySha256: sha256 }).superRefine((i, c) => { if (['GET', 'HEAD'].includes(i.method) && i.bodySha256 !== 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    c.addIssue({ code: 'custom', message: 'Safe reads require an empty body' }); });
export const previewWriteCloseRequest = z.strictObject({ schemaVersion: z.literal('devmesh.preview-write-close.v1'), operationId: ids.operation, projectId: ids.project, datasetId: ids.dataset, datasetOperationId: ids.operation, datasetRequestHash: sha256, expectedFence: z.number().int().nonnegative().safe() });
export const previewAccessObservation = z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('FINISHED'), httpStatus: z.number().int().min(200).max(599), responseSha256: sha256, checkedAt: timestamp }),
    z.strictObject({ state: z.literal('UNKNOWN'), errorCode: opaqueKey, checkedAt: timestamp }),
    z.strictObject({ state: z.literal('NOT_SENT'), errorCode: opaqueKey, checkedAt: timestamp }),
]);
export const previewAccessRequests = {
    registerPreviewAccessPolicy: z.strictObject({ principalId: opaqueKey, projectId: ids.project, policy: previewAccessPolicy }),
    enrollPreviewWriteGate: z.strictObject(dataset),
    getPreviewWriteGate: z.strictObject(dataset),
    closePreviewWriteGate: z.strictObject({ principalId: opaqueKey, request: previewWriteCloseRequest, requestHash: sha256 }),
    resolvePreviewAccess: z.strictObject({ ...gateway, ...target }),
    preparePreviewAccessRequest: z.strictObject({ ...gateway, ...target, accessRequestId: opaqueKey, request: previewAccessHttpRequest }),
    beginPreviewAccessRequest: z.strictObject(original),
    previewAccessRequestAuthorized: z.strictObject(original),
    getPreviewAccessRequest: z.strictObject(original),
    recordPreviewAccessObservation: z.strictObject({ ...original, observation: previewAccessObservation }),
    listPreviewAccessRequests: z.strictObject({ ...gateway, projectId: ids.project, afterSequence: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(100).default(20) }),
};
export interface PreviewWriteGate {
    datasetId: string;
    projectId: string;
    datasetOperationId: string;
    datasetRequestHash: string;
    state: 'OPEN' | 'CLOSED';
    fence: number;
    revision: number;
    closeOperationId: string | null;
    closeRequestHash: string | null;
    pendingWrites: number;
    createdAt: string;
    updatedAt: string;
}
export interface PreviewAccessTarget {
    projectId: string;
    runId: string;
    previewId: string;
    candidateId: string;
    manifestHash: string;
    policyHash: string;
    datasetId: string;
    datasetOperationId: string;
    datasetRequestHash: string;
    imageDigest: string;
    instanceId: string;
    startOperationId: string;
    startRequestHash: string;
    runnerId: string;
    backendRef: string;
    endpoint: {
        host: '127.0.0.1';
        port: number;
    };
    expiresAt: string;
}
export interface PreviewAccessBinding {
    target: PreviewAccessTarget;
    gate: PreviewWriteGate;
    canWrite: boolean;
    healthCheckedAt: string;
}
export interface PreviewAccessRecord {
    accessRequestId: string;
    gatewayId: string;
    configurationHash: string;
    subjectPrincipalId: string;
    target: PreviewAccessTarget;
    request: z.output<typeof previewAccessHttpRequest>;
    requestHash: string;
    gateFence: number;
    state: 'PREPARED' | 'DISPATCHED' | 'UNKNOWN' | 'FINISHED' | 'NOT_SENT';
    revision: number;
    observation: z.output<typeof previewAccessObservation> | null;
    createdAt: string;
    dispatchedAt: string | null;
    finishedAt: string | null;
}
export type PreviewAccessMethod = keyof typeof previewAccessRequests;
export type PreviewAccessInput<M extends PreviewAccessMethod> = z.output<(typeof previewAccessRequests)[M]>;
export interface PreviewAccessResults {
    registerPreviewAccessPolicy: {
        policy: z.output<typeof previewAccessPolicy>;
    };
    enrollPreviewWriteGate: PreviewWriteGate;
    getPreviewWriteGate: PreviewWriteGate;
    closePreviewWriteGate: {
        gate: PreviewWriteGate;
        closeRequest: z.output<typeof previewWriteCloseRequest>;
        current: boolean;
    };
    resolvePreviewAccess: PreviewAccessBinding;
    preparePreviewAccessRequest: PreviewAccessRecord;
    getPreviewAccessRequest: PreviewAccessRecord;
    beginPreviewAccessRequest: {
        dispatch: boolean;
        record: PreviewAccessRecord;
    };
    previewAccessRequestAuthorized: {
        allowed: boolean;
    };
    recordPreviewAccessObservation: PreviewAccessRecord;
    listPreviewAccessRequests: {
        items: {
            sequence: number;
            record: PreviewAccessRecord;
        }[];
        nextSequence: number | null;
    };
}
