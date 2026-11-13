import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {parse} from 'tldts';
import {z} from 'zod';
import {opaqueKey} from '@devmesh/contracts';
import {canonical, previewOrigin as releaseOrigin} from '@devmesh/storage-sqlite';

export const releaseGatewayConfig = z.strictObject({
  enabled: z.boolean().default(false),
  mode: z.enum(['loopback-development', 'shared']),
  gatewayId: opaqueKey,
  principalId: opaqueKey,
  platformOrigin: releaseOrigin,
  releaseBaseOrigin: releaseOrigin,
  ticketTtlMs: z.number().int().min(1000).max(60000).default(60000),
  sessionTtlMs: z.number().int().min(1000).max(300000).default(300000),
  maximumRequestBytes: z.number().int().min(1024).max(1024 * 1024).default(1024 * 1024),
  maximumInFlight: z.number().int().min(1).max(64).default(16),
  requestTimeoutMs: z.number().int().min(100).max(30000).default(15000),
}).superRefine((c, ctx) => {
  const platform = new URL(c.platformOrigin), release = new URL(c.releaseBaseOrigin);
  const p = parse(platform.hostname, {allowPrivateDomains: true});
  const v = parse(release.hostname, {allowPrivateDomains: true});
  const localPlatform = c.mode === 'loopback-development' && ['127.0.0.1', '[::1]'].includes(platform.hostname);
  if (release.protocol !== 'https:' || c.mode === 'shared' && platform.protocol !== 'https:')
    ctx.addIssue({code: 'custom', message: 'Release uses HTTPS; shared platform also requires HTTPS'});
  if (isIP(release.hostname) || !p.domain && !localPlatform || !v.domain || p.domain === v.domain || release.hostname === v.domain)
    ctx.addIssue({code: 'custom', message: 'Use a release subdomain below a separate registrable domain'});
  if (c.mode === 'shared' && (!(p.isIcann || p.isPrivate) || !(v.isIcann || v.isPrivate)))
    ctx.addIssue({code: 'custom', message: 'Shared origins require public/private suffix recognition'});
});
export type ReleaseGatewayConfig = z.input<typeof releaseGatewayConfig>;
export type ResolvedReleaseGatewayConfig = z.output<typeof releaseGatewayConfig>;
export const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
export function releaseGatewayConfiguration(input: ReleaseGatewayConfig) {
  const config = releaseGatewayConfig.parse(input);
  return {config, configurationHash: sha256(canonical({schemaVersion: 'devmesh.release-gateway.v1', ...config}))};
}
export function originForRelease(config: ResolvedReleaseGatewayConfig, releaseId: string) {
  const url = new URL(config.releaseBaseOrigin);
  url.hostname = `r-${sha256(releaseId).slice(0, 40)}.${url.hostname}`;
  return url.origin;
}
