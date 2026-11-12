import {z} from 'zod';
import {opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import {previewStopRequest,acceptanceReleaseClaim} from '@devmesh/storage-sqlite';

export const previewReleaseClaim=acceptanceReleaseClaim;
export const runnerPreviewLifecycle=z.strictObject({reservationId:opaqueKey,requestHash:sha256,state:z.enum(['PREVIEW','STOPPING','RELEASE_HELD','RELEASE_OWNED']),revision:z.number().int().nonnegative(),expiresAt:timestamp,expiredAt:timestamp.nullable(),lastWallAt:timestamp,releaseClaim:previewReleaseClaim.nullable(),releaseClaimHash:sha256.nullable(),expiryRequest:previewStopRequest.nullable(),expiryRequestHash:sha256.nullable(),createdAt:timestamp,updatedAt:timestamp});
export type RunnerPreviewLifecycle=z.output<typeof runnerPreviewLifecycle>;
export type PreviewReleaseClaim=z.output<typeof previewReleaseClaim>;
