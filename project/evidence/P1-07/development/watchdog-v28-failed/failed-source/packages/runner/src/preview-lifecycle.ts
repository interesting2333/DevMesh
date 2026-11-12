import {z} from 'zod';
import {ids,opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import {previewStopRequest} from '@devmesh/storage-sqlite';

export const previewReleaseClaim=z.strictObject({schemaVersion:z.literal('devmesh.preview-release-claim.v1'),operationId:ids.operation,releaseId:ids.release,candidateId:ids.candidate,manifestHash:sha256,previewId:ids.preview,datasetId:ids.dataset,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),startOperationId:ids.operation,startRequestHash:sha256,instanceId:opaqueKey,acceptanceRequestHash:sha256});
export const runnerPreviewLifecycle=z.strictObject({reservationId:opaqueKey,requestHash:sha256,state:z.enum(['PREVIEW','STOPPING','RELEASE_HELD','RELEASE_OWNED']),revision:z.number().int().nonnegative(),expiresAt:timestamp,expiredAt:timestamp.nullable(),lastWallAt:timestamp,releaseClaim:previewReleaseClaim.nullable(),releaseClaimHash:sha256.nullable(),expiryRequest:previewStopRequest.nullable(),expiryRequestHash:sha256.nullable(),createdAt:timestamp,updatedAt:timestamp});
export type RunnerPreviewLifecycle=z.output<typeof runnerPreviewLifecycle>;
export type PreviewReleaseClaim=z.output<typeof previewReleaseClaim>;
