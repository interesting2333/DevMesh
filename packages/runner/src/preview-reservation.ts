import {z} from 'zod';
import {opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import {previewStartRequest,previewRuntimeFact} from '@devmesh/storage-sqlite';

/** Trusted Runner configuration, never an admission budget supplied by a project user. */
export const runnerCapacity=z.strictObject({maximumJobs:z.number().int().min(1).max(4),cpu:z.number().positive().max(64),memoryMiB:z.number().int().min(64).max(131072)});
export const previewResourceLimits=z.strictObject({cpu:z.number().positive().max(64),memoryMiB:z.number().int().min(64).max(131072),pids:z.number().int().min(16).max(256),temporaryMiB:z.number().int().min(16).max(10240)});
export const reservePreview=z.strictObject({request:previewStartRequest,requestHash:sha256,resourceLimits:previewResourceLimits,capacity:runnerCapacity});
export const previewReservationSchema=z.strictObject({reservationId:opaqueKey,controllerId:opaqueKey,request:previewStartRequest,requestHash:sha256,resourceLimits:previewResourceLimits,state:z.enum(['RESERVED','DISPATCHED','ACTIVE','UNKNOWN','EXITED','CANCELLED']),revision:z.number().int().nonnegative(),instanceId:opaqueKey.nullable(),endpoint:z.strictObject({host:z.literal('127.0.0.1'),port:z.number().int().min(1024).max(65535)}).nullable(),fact:previewRuntimeFact.nullable(),createdAt:timestamp,updatedAt:timestamp,releasedAt:timestamp.nullable()});
export type RunnerCapacity=z.output<typeof runnerCapacity>;
export type PreviewResourceLimits=z.output<typeof previewResourceLimits>;
export type PreviewReservation=z.output<typeof previewReservationSchema>;
export interface RunnerCapacityUsage {slots:number;cpu:number;memoryMiB:number;previewSlots:number;jobSlots:number}
