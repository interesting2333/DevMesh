import { z } from 'zod';
import { role,ids,opaqueKey,parseContract } from '@devmesh/contracts';
import { ModelError } from './provider.js';
import type { ModelProvider } from './provider.js';
export const roleSchemas:Readonly<Record<string,string>>=Object.freeze({product:'devmesh.requirements.v1',architect:'devmesh.architecture.v1',developer:'devmesh.development-result.v1',tester:'devmesh.test-result.v1'});
export const roleConfigSchema=z.strictObject({role,revision:opaqueKey,provider:opaqueKey,model:opaqueKey,promptArtifactId:ids.artifact,outputSchemaId:opaqueKey,allowedTools:z.array(opaqueKey).max(128),maxSteps:z.number().int().min(1).max(200),contextLimitTokens:z.number().int().min(1024),outputReserveTokens:z.number().int().positive(),requestTimeoutMs:z.number().int().min(10).max(300000),maxReadOnlyRetries:z.number().int().min(0).max(5)}).superRefine((v,c)=>{if(v.outputSchemaId!==roleSchemas[v.role]||new Set(v.allowedTools).size!==v.allowedTools.length||v.outputReserveTokens>=v.contextLimitTokens)c.addIssue({code:'custom',message:'Role schema, tool names or context budget are incompatible'});});
export type RoleConfig=z.output<typeof roleConfigSchema>;
export class RoleRegistry {
 readonly #providers=new Map<string,ModelProvider>();
 constructor(providers:ModelProvider[]){for(const p of providers){if(this.#providers.has(p.config.providerId))throw new Error('Duplicate providerId');this.#providers.set(p.config.providerId,p);}}
 resolve(input:unknown):{role:RoleConfig;provider:ModelProvider}{
  const role=parseContract(roleConfigSchema,input),provider=this.#providers.get(role.provider);
  if(!provider)throw new ModelError('MODEL_NOT_CONFIGURED',false,'not-sent');
  if(provider.config.model!==role.model||provider.config.requestTimeoutMs!==role.requestTimeoutMs||role.contextLimitTokens>provider.config.capabilities.contextTokens||role.outputReserveTokens>provider.config.capabilities.maxOutputTokens)throw new ModelError('MODEL_CONFIGURATION_MISMATCH',false,'not-sent');
  Object.freeze(role.allowedTools);Object.freeze(role);return {role,provider};
 }
}
