import {z} from 'zod';
import {opaqueKey,sha256,timestamp,ids} from '@devmesh/contracts';
import {dockerObjectId} from './preview-container.js';
export const previewCleanupKind=z.enum(['CONTAINER_REMOVE','NETWORK_REMOVE']);
export const previewCleanupRequest=z.strictObject({schemaVersion:z.literal('devmesh.preview-cleanup.v1'),operationId:ids.operation,reservationId:opaqueKey,startRequestHash:sha256,profileHash:sha256,stopRequestHash:sha256,containerId:dockerObjectId,networkId:dockerObjectId,kind:previewCleanupKind});
export const previewCleanupObservation=z.strictObject({objectId:dockerObjectId,absenceVerified:z.literal(true),checkedAt:timestamp});
export const previewCleanupAction=z.strictObject({request:previewCleanupRequest,requestHash:sha256,state:z.enum(['SENT','OBSERVED']),observation:previewCleanupObservation.nullable(),createdAt:timestamp,observedAt:timestamp.nullable()});
export type PreviewCleanupKind=z.output<typeof previewCleanupKind>;
export type PreviewCleanupAction=z.output<typeof previewCleanupAction>;
