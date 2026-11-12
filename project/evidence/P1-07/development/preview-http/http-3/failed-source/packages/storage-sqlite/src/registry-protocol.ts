import { z } from 'zod';
import { opaqueKey, role, revision, sha256, timestamp, workDelegation } from '@devmesh/contracts';

const address=z.url().refine(value=>{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!u.hash&&!u.search;},'An HTTP(S) service URL without credentials/query is required');
export const endpointConfig=z.strictObject({endpointId:opaqueKey,revision,role:role.optional(),agentKey:opaqueKey,hosting:z.enum(['local','remote']),implementationVersion:opaqueKey,address,cardUrl:address,cardHash:sha256,protocol:z.literal('1.0'),sdkVersion:z.literal('1.3.0'),supportedSkills:z.array(opaqueKey).min(1).max(64),streaming:z.boolean(),credentialRef:opaqueKey,allowedCallers:z.array(opaqueKey).min(1).max(64),enabled:z.boolean()});
export const agentManifest=z.strictObject({schemaVersion:z.literal('devmesh.agent-manifest.v1'),manifestRevision:opaqueKey,endpoints:z.array(endpointConfig).min(1).max(100)}).superRefine((v,c)=>{const ids=new Set(),roles=new Set();for(const e of v.endpoints){if(ids.has(e.endpointId))c.addIssue({code:'custom',message:'Duplicate endpointId'});ids.add(e.endpointId);if(e.role){if(roles.has(e.role))c.addIssue({code:'custom',message:'Duplicate workflow role'});roles.add(e.role);}}});
const checkResult=z.strictObject({checkId:opaqueKey,status:z.enum(['HEALTHY','UNHEALTHY','NEEDS_REVIEW']),observedCardHash:sha256.nullable(),checkedAt:timestamp,expiresAt:timestamp,errorCode:opaqueKey.nullable()});
const taskKey={callerId:opaqueKey,endpointId:opaqueKey,taskId:opaqueKey};
const version={generationId:opaqueKey,projectionRevision:revision};
const jsonObject=z.record(z.string(),z.json());
export const registryRequests={
 getRegistrySnapshot:z.strictObject({}),
 issueEndpointProbe:z.strictObject({endpoint:endpointConfig}),
 commitRegistry:z.strictObject({manifest:agentManifest,expectedProjectionRevision:z.number().int().nonnegative(),checks:z.array(checkResult).max(100)}),
 recordEndpointCheck:checkResult,
 setEndpointLifecycle:z.strictObject({actorId:opaqueKey,endpointId:opaqueKey,revision,lifecycle:z.enum(['ACTIVE','DRAINING','RETIRED']),reason:z.string().min(1).max(2000)}),
 assertRegistryTarget:z.strictObject({...version,endpointId:opaqueKey,revision,role:role.optional(),cardHash:sha256}),
 acceptA2AWork:z.strictObject({callerId:opaqueKey,endpointId:opaqueKey,endpointRevision:revision,delegation:workDelegation,message:jsonObject,...version}),
 getA2ATask:z.strictObject(taskKey),
 listA2ATasks:z.strictObject({callerId:opaqueKey,endpointId:opaqueKey,afterId:opaqueKey.optional(),limit:z.number().int().min(1).max(100).default(50)}),
 listA2ATaskEvents:z.strictObject({...taskKey,afterSeq:z.number().int().nonnegative().default(0)}),
 cancelA2ATask:z.strictObject(taskKey),
 claimAcceptedWork:z.strictObject({endpointId:opaqueKey,workerId:opaqueKey,limit:z.number().int().min(1).max(10).default(1)}),
 settleAcceptedWork:z.strictObject({endpointId:opaqueKey,taskId:opaqueKey,workerId:opaqueKey,claimToken:opaqueKey,state:z.enum(['working','input-required','auth-required','completed','failed','canceled','rejected']),snapshot:jsonObject,stopVerified:z.boolean().default(false)}),
 recoverAcceptedWork:z.strictObject({}),
};
export type RegistryMethod=keyof typeof registryRequests;
export type RegistryInput<M extends RegistryMethod>=z.output<(typeof registryRequests)[M]>;
export type EndpointConfig=z.infer<typeof endpointConfig>;
export type AgentManifest=z.infer<typeof agentManifest>;
export type EndpointView={config:EndpointConfig;configHash:string;lifecycle:string;checkId:string|null;status:string;expiresAt:string|null;checkSequence:number};
export type RegistrySnapshot={generationId:string|null;projectionRevision:number;manifestRevision:string|null;manifestHash:string|null;endpoints:EndpointView[];bindings:{role:string;endpointId:string;revision:number}[]};
export type A2ATaskRecord={endpointId:string;taskId:string;contextId:string;state:string;revision:number;cancelRequested:boolean;snapshot:Record<string,unknown>};
export interface RegistryResults{
 getRegistrySnapshot:RegistrySnapshot;
 issueEndpointProbe:{checkId:string;sequence:number};
 commitRegistry:RegistrySnapshot;
 recordEndpointCheck:{applied:boolean;projectionRevision:number};
 setEndpointLifecycle:RegistrySnapshot;
 assertRegistryTarget:EndpointView;
 acceptA2AWork:A2ATaskRecord;
 getA2ATask:A2ATaskRecord;
 listA2ATasks:{tasks:A2ATaskRecord[];nextPageToken:string;totalSize:number};
 listA2ATaskEvents:{seq:number;snapshot:Record<string,unknown>}[];
 cancelA2ATask:A2ATaskRecord;
 claimAcceptedWork:{endpointId:string;taskId:string;workerId:string;claimToken:string;delegation: z.infer<typeof workDelegation>}[];
 settleAcceptedWork:A2ATaskRecord;
 recoverAcceptedWork:{reconcileCount:number};
}
