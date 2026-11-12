import {z} from 'zod';

// Deliberately bounded OCI 1.1.0 delivery profile. Image content identity is
// distinct from approved build provenance and actual runtime health.
export const previewImageLimits={manifestBytes:1024*1024,configBytes:1024*1024,blobBytes:64*1024*1024,totalBytes:256*1024*1024,layers:16} as const;
const digest=z.string().regex(/^sha256:[a-f0-9]{64}$/),size=z.number().int().min(0).max(previewImageLimits.blobBytes);
const descriptor=z.object({mediaType:z.string(),digest,size});
export const previewImageManifest=z.object({schemaVersion:z.literal(2),mediaType:z.literal('application/vnd.oci.image.manifest.v1+json'),
 config:descriptor.extend({mediaType:z.literal('application/vnd.oci.image.config.v1+json')}),
 layers:z.array(descriptor.extend({mediaType:z.enum(['application/vnd.oci.image.layer.v1.tar','application/vnd.oci.image.layer.v1.tar+gzip'])})).min(1).max(previewImageLimits.layers)});
export const previewImageConfig=z.object({os:z.literal('linux'),architecture:z.enum(['amd64','arm64']),
 config:z.object({Labels:z.record(z.string(),z.string())}),rootfs:z.object({type:z.literal('layers'),diff_ids:z.array(digest).min(1).max(previewImageLimits.layers)})});
