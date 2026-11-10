import { z } from 'zod';
import { parseContract } from '@devmesh/contracts';
import { providerConfigSchema } from './provider.js';
const schema=z.strictObject({providers:z.array(providerConfigSchema).min(1).max(16),tokenLimit:z.number().int().positive()}).superRefine((v,c)=>{if(new Set(v.providers.map(p=>p.providerId)).size!==v.providers.length)c.addIssue({code:'custom',message:'providerId must be unique'});});
export type RuntimeConfig=z.output<typeof schema>;
export function parseRuntimeConfig(value:unknown):RuntimeConfig{return parseContract(schema,value);}
