import { z } from 'zod';
import { opaqueKey, parseContract, relativeFile } from '@devmesh/contracts';
import { providerConfigSchema } from './provider.js';
const preparation=z.strictObject({callerId:opaqueKey,productProviderId:opaqueKey,architectProviderId:opaqueKey,
  maxInputBytes:z.number().int().min(1024).max(2*1024*1024),maxOutputTokens:z.number().int().min(1).max(32768),
  bootstrapPaths:z.array(relativeFile).max(16).default([])});
const schema=z.strictObject({providers:z.array(providerConfigSchema).min(1).max(16),tokenLimit:z.number().int().positive(),preparation:preparation.optional()}).superRefine((v,c)=>{
  const ids=new Set(v.providers.map(p=>p.providerId));
  if(ids.size!==v.providers.length)c.addIssue({code:'custom',message:'providerId must be unique'});
  if(v.preparation&&(!ids.has(v.preparation.productProviderId)||!ids.has(v.preparation.architectProviderId)))c.addIssue({code:'custom',path:['preparation'],message:'Preparation requires configured product and architect providers'});
  if(v.preparation&&new Set(v.preparation.bootstrapPaths).size!==v.preparation.bootstrapPaths.length)c.addIssue({code:'custom',path:['preparation','bootstrapPaths'],message:'Bootstrap paths must be unique'});
});
export type RuntimeConfig=z.output<typeof schema>;
export function parseRuntimeConfig(value:unknown):RuntimeConfig{return parseContract(schema,value);}
