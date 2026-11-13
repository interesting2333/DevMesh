# DevMesh platform host

## Trusted acceptance preparation

`startPlatform` has no default preparation backend. A trusted host may install an already constructed backend after registering its immutable policy through the private storage service. This factory is executable host composition, not a public HTTP/MCP registration or JSON option.

```ts
await startPlatform(config, {
  acceptancePolicies: { [projectId]: policyHash },
  acceptancePreparation: () => ({
    bindings: [{ projectId, policyHash, principalId, backendRef, runnerId, backend }],
    pollIntervalMs: 5000,
    maxConcurrentProjects: 2,
    maxScopesPerPass: 32,
    pageSize: 1,
  }),
});
```

The identifiers above come from trusted composition and the registered policy; `backend` implements `AcceptancePreparationBackend`. The host requires explicitly configured storage and Input API, snapshots its project-policy map, then verifies each binding against the original registered policy. One binding per project, at most 32 projects, is permitted. Disabled or mismatched explicit configuration fails startup and releases host resources. The caller owns externally constructed backend resources and their lifecycle.

The consumer scans only unresolved original preparations. Failed, aborting, aborted and committed history does not consume work-page slots. Concurrent ticks coalesce; each project is serial and at most two projects run concurrently. Configurable scope/page budgets and rotating cursors bound a pass. Scope failures retain only safe error codes and do not block other projects.

Only PREPARED can obtain the original one-time dispatch grant. SENT/UNKNOWN are inspected, including after acknowledgement loss and restart. Periodic trusted inspection can update current health while retaining the same immutable proof; API reads remain inert. The health window is still 30 seconds. A busy backend or deliberately small scan budget can cause health to expire; current readiness then closes final acceptance until an independent observation succeeds. Poll intervals are 1–10 seconds, scope budgets 1–32, page sizes 1–20 and concurrency 1–2. This scheduler does not bypass Runner capacity or perform T5, publication or cleanup.

`stop()` synchronously revokes new scan/dispatch authorization and waits for active calls before the host closes storage. A paused preflight cannot subsequently acquire a dispatch grant. An in-flight backend's authorization callback closes immediately on stop. The interface cannot forcibly cancel a non-returning adapter; trusted adapters must bound their own I/O. Drain does not race against a timeout or pretend an unknown side effect has ended.

The CLI still installs no model identity, OIDC provider or physical Docker/gVisor/fence adapter by default. Local protocol fixtures do not qualify physical isolation, data migration or product acceptance.
