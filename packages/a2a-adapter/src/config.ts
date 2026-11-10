import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { z } from 'zod';
import { agentManifest } from '@devmesh/storage-sqlite';
import type { AgentManifest } from '@devmesh/storage-sqlite';
import { opaqueKey, parseContract } from '@devmesh/contracts';

export interface ServiceIdentity { principalId: string; credentialRef: string }
export interface InternalA2AConfig { manifest: AgentManifest; identities: ServiceIdentity[] }
export function loadInternalA2AConfig(value: unknown, configPath?: string): InternalA2AConfig {
  const config = parseContract(z.strictObject({ manifestPath: z.string().min(1), identities: z.array(z.strictObject({ principalId: opaqueKey, credentialRef: opaqueKey })).max(32) }), value);
  if (new Set(config.identities.map(identity => identity.principalId)).size !== config.identities.length || new Set(config.identities.map(identity => identity.credentialRef)).size !== config.identities.length) throw new Error('Service identities and credential references must be unique');
  const path = resolve(configPath ? dirname(resolve(configPath)) : process.cwd(), config.manifestPath);
  return { manifest: parseContract(agentManifest, JSON.parse(readFileSync(path, 'utf8'))), identities: config.identities };
}
