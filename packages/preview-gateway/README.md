# Preview HTTPS gateway

This package provides `PreviewGateway` for explicit trusted composition. It is
disabled by default and is not automatically mounted by `startPlatform`. A trusted
platform identity resolver, remote Runner RPC adapter, deployment DNS/TLS and
operational composition remain separate work. Input API preview routes accept an
explicit `previewGateway` through `startPlatform` options; they do not create its
HTTPS listener or issue credentials without a configured identity. The user has authorized
local development without OIDC or real Linux/container resources.

`gatewayConfiguration` validates canonical origins, HTTPS and separate registrable
sites using pinned `tldts` with private suffix support. The base preview origin must
have a subdomain; `originForPreview` derives one independent host per preview ID.
Local development may use an exact loopback IP as the platform origin; the preview
still requires a separate HTTPS DNS host and loopback peer. Shared mode keeps its
HTTPS and separate registrable domain requirements, without that local exception.
The configuration hash covers all parsed options, including limits. Register
`gateway.policy` as the project's current owner and separately enroll the original
dataset backend's write gate. No HTTP endpoint can register those service rights.

Only call `issueForMember` after the platform has resolved and authorized the actual
user. An HTTP-supplied principal is never identity. The return contains a random
ticket, preview origin, ticket expiry and `sessionExpiresAt`. The browser sends
`{ticket, expiresAt: sessionExpiresAt}` as JSON to
`POST <previewOrigin>/__devmesh/preview/session`, with `credentials: include`.
The gateway requires the exact configured platform Origin and allows only its
credentialed CORS exchange. Session expiry remains bounded in the storage domain;
the supplied expiry cannot extend a ticket, session or preview lifetime.
`GET` on the same session path, with the exact platform Origin and credentials,
revalidates the current HttpOnly session and returns only its expiry. The platform
page uses this to confirm the browser retained its cross-site Cookie before
loading the iframe. It does not dispatch an application request or mint a ticket.

The session Cookie is `__Host-devmesh-preview`, Path=/, Secure, HttpOnly and
SameSite=None, with no Domain. Business writes require the exact preview Origin and
an `Idempotency-Key` of 16–128 ASCII letters/digits/underscore/hyphen. The gateway
namespaces the key by its immutable configuration, current subject and preview,
binds sanitized request headers/body/raw path, obtains one durable dispatch grant
and calls its trusted Runner transport. A repeated write returns HTTP 409 with
`PREVIEW_REQUEST_ALREADY_RECORDED`, original request ID and state; it does not send
again or reconstruct the original response from its hash. The template preserves
its pending key for explicit recovery rather than starting a replacement write.

Only accept, accept-language, content-type, if-match, if-none-match and range are
forwarded from the browser. A derived business idempotency key, loopback Host and
body length are set by trusted code. Cookie, Authorization, Origin, Referer and
forwarded identity headers never reach the application. Upstream Set-Cookie,
Location and hop-by-hop headers are not passed to the browser. CSP fixes its parent
platform, limits scripts/connections to the preview host and forbids workers,
popups, top navigation and nested frames. The parent should also set the iframe's
`sandbox="allow-scripts allow-forms allow-same-origin"`; the separate site prevents
the child from removing the parent's restrictions.

`RunnerPreviewHttpTransport` is composed on the original Runner. It checks the
immutable original reservation/hash/instance/dataset/image/port, inspects current
driver and actual HTTP health, checks Runner lifecycle, then rechecks the gateway's
current authorization. It uses only the original 127.0.0.1 high port, no caller URL,
DNS lookup, redirect, pooled connection or retry. Before constructing HTTP, a failed
check is definite NOT_SENT. After construction, an incomplete response is UNKNOWN.
A complete error response is still FINISHED transport accounting. Content is
returned only after session/member revalidation. Logout revokes its original
session and clears its Cookie, without draining unknown writes.

The trusted HTTPS owner binds `gateway.handle`, enforces server header/body and
shutdown deadlines, and refuses upgrades/CONNECT. The handler also limits in-flight
requests, body bytes and duration. `gateway.close()` closes admission and aborts
active transport signals; it does not prove physical database drain or completion
of acceptance. Shared deployment requires configured trusted TLS/identity/Runner
composition; loopback development still requires HTTPS and a loopback peer.

Validation uses real local HTTPS, control/Runner SQLite Workers and the template's
actual HTTP/SQLite code, with explicit candidate/image/container facts. Browser
verification is an independent command, `pnpm test:preview-browser`, after the
template's pinned dependencies and a supported Chromium channel are available.
On this host it uses installed Edge and ephemeral test certificates/DNS mappings,
without certificate-store changes. Browser TLS errors are ignored for these test
certificates; Node HTTPS separately verifies the preview certificate using an
explicit CA. These are not OIDC, actual OCI execution, production topology or T5
acceptance results.
