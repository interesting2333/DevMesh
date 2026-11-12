import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ClientFactory, DefaultAgentCardResolver, JsonRpcTransportFactory } from '@a2a-js/sdk/client';
import { SendMessageRequest } from '@a2a-js/sdk';

/** Credentials go only to the operator-supplied loopback origin. No request replay. */
export async function probePrototype({ baseUrl, cardPath = '/.well-known/agent-card.json', token, nonce = 'example_probe' }) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(base.hostname) || !base.port || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('Explicit trusted loopback origin required');
  if (!/^\/(?:\.well-known\/agent-card\.json|(?:agents|groups)\/[a-zA-Z0-9_-]+\/agent-card\.json)$/.test(cardPath) || !/^[\x21-\x7e]{32,2048}$/.test(token ?? '')) throw new Error('Card path or prototype credential is invalid');
  const authenticatedFetch = async (input, init) => {
    const target = new URL(input instanceof Request ? input.url : String(input));
    if (target.origin !== base.origin || target.username || target.password) throw new Error('Card points outside trusted origin');
    const headers = new Headers(init?.headers); headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers, redirect: 'error', signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) });
  };
  const factory = new ClientFactory({ cardResolver: new DefaultAgentCardResolver({ fetchImpl: authenticatedFetch }), transports: [new JsonRpcTransportFactory({ fetchImpl: authenticatedFetch })] });
  const client = await factory.createFromUrl(base.origin, cardPath);
  const params = SendMessageRequest.fromJSON({ message: { messageId: randomUUID(), role: 'ROLE_USER', parts: [{ data: { kind: 'devmesh.protocol-probe.v1', nonce } }] } });
  const reply = await client.sendMessage(params), streamed = [];
  for await (const event of client.sendMessageStream(params)) streamed.push(event);
  return { reply, streamed };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  probePrototype({ baseUrl: process.argv[2] ?? '', cardPath: process.argv[3] ?? '/.well-known/agent-card.json', token: process.env.DEVMESH_PROTOTYPE_TOKEN })
    .then(result => console.log(JSON.stringify(result)))
    .catch(() => { console.error('Prototype probe failed; check local configuration and permissions'); process.exitCode = 1; });
}
