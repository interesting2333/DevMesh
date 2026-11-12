import {z} from 'zod';
import {ids,gitCommit,sha256,opaqueKey,revision,artifactRef} from './primitives.js';
import {qualityPath} from './source-path.js';

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

export const previewImageIdentity=z.strictObject({schemaVersion:z.literal('devmesh.preview-image-identity.v1'),imageDigest:digest,configDigest:digest,targetCommit:gitCommit,buildArtifactHash:sha256,os:z.literal('linux'),architecture:z.enum(['amd64','arm64']),layers:z.array(z.strictObject({digest,diffId:digest,byteSize:size,expandedByteSize:size})).min(1).max(previewImageLimits.layers)});
const baseData={schemaVersion:z.literal('devmesh.data-plan.v1'),runId:ids.run,codeCommit:gitCommit,requirementRevision:revision,planRevision:revision,templateVersion:opaqueKey,checkConfigHash:sha256};
const initialData=z.enum(['EMPTY','DEMO']);
export const deliveryDataPlan=z.discriminatedUnion('strategy',[
 z.strictObject({...baseData,strategy:z.literal('INITIAL'),initialData,sourceReleaseId:z.null(),migrationRef:z.null(),replacementDecisionId:z.null()}),
 z.strictObject({...baseData,strategy:z.literal('PRESERVE_MIGRATE'),initialData:z.null(),sourceReleaseId:ids.release,migrationRef:artifactRef,replacementDecisionId:z.null()}),
 z.strictObject({...baseData,strategy:z.literal('REPLACE'),initialData,sourceReleaseId:ids.release,migrationRef:z.null(),replacementDecisionId:ids.decision}),
]);
const coreKeys=['build','image.manifest','image.config','data.plan','run.instructions','collaboration.record','role.configuration'] as const;
const deliveryProfileFields={producerId:opaqueKey,architecture:z.enum(['amd64','arm64']),materials:z.array(z.strictObject({key:opaqueKey,path:qualityPath})).min(8).max(coreKeys.length+previewImageLimits.layers)};
function validateProfile(p:z.output<ReturnType<typeof profileSchema>>,c:z.RefinementCtx){
 const fail=(message:string)=>c.addIssue({code:'custom',message}),keys=p.materials.map(m=>m.key),paths=p.materials.map(m=>m.path.toLowerCase());
 if(new Set(keys).size!==keys.length||new Set(paths).size!==paths.length)fail('Unique delivery material keys and paths required');
 if(coreKeys.some(key=>!keys.includes(key)))fail('All fixed delivery materials required');
 const layers=keys.filter(key=>!coreKeys.includes(key as typeof coreKeys[number])).sort((a,b)=>Number(a.slice(12))-Number(b.slice(12)));
 if(!layers.length||layers.some((key,index)=>key!=='image.layer.'+index))fail('Contiguous bounded image layer outputs required');
}
function profileSchema(){return z.strictObject(deliveryProfileFields);}
export const releaseDeliveryProfile=profileSchema().superRefine(validateProfile);
export const releaseDeliveryPolicy=z.strictObject({schemaVersion:z.literal('devmesh.delivery-policy.v1'),templateVersion:opaqueKey,checkConfigHash:sha256,...deliveryProfileFields}).superRefine(validateProfile);
export type ReleaseDeliveryPolicy=z.output<typeof releaseDeliveryPolicy>;
export type DeliveryDataPlan=z.output<typeof deliveryDataPlan>;
