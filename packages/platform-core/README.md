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

## Trusted publication recovery

An explicit trusted host can also consume already accepted original publication Outbox records:

```ts
await startPlatform(config, {
  releasePublication: () => ({
    bindings: [{ projectId, policyHash, principalId, backendRef, runnerId, backend }],
    pollIntervalMs: 5000,
    maxConcurrentProjects: 2,
    maxScopesPerPass: 32,
    pageSize: 1,
  }),
});
```

Here `backend` implements `ReleasePublicationBackend`; `RunnerReleaseServiceBackend` is one explicit implementation when its actual physical adapters are available. Durable storage and matching original registered acceptance policy are required. Input API and new acceptance entry need not remain enabled for recovery of an already accepted Release. There is no default publisher or public backend registration. The host validates all bindings and completes other startup composition before starting publication consumption. External adapter resources remain caller-owned.

Only the current accepted Release's PENDING/SENT/UNKNOWN publication is work; published and superseded history stays in the separate history query. PENDING receives the original one-time publish grant. SENT/UNKNOWN inspects the original object, then uses optional authorized `resume` to continue the original Runner journal. Each new Runner stage still requires its own durable grant; an uncertain dispatched stage is only queried. No replacement Release, T5 or data migration is initiated. A missing continuation implementation leaves UNKNOWN. Publication failures preserve accepted facts and the closed target write gate; only the writer's validated full publication proof opens that gate.

The bounds are 1–32 projects, one binding per project, 1–30 second polling, 1–32 scopes and 1–20 items per scope per pass, with 1–2 projects concurrent and each project serial. Ticks coalesce and scopes rotate; errors expose only safe codes. The publication consumer shares the stop/drain contract above, including final publish/resume authorization checks. Stopping never opens a gate or pretends a physical operation has completed. Published proof history is not periodically rewritten to refresh health.

## Trusted abort recovery

A trusted `startPlatform(config, { acceptanceAbort: services => ({ bindings: [{ projectId, policyHash, principalId, backendRef, runnerId, backend }] }) })` factory can install an `AcceptanceAbortRecoveryBackend`. `RunnerAcceptanceAbortCoordinator` composes original Runner cleanup and finalization when its actual adapters are available. Explicit durable storage and matching original DB policy are required; Input API, new acceptance policies and current owner membership are not required to recover an already confirmed original decision. No backend is installed by default. All startup composition must succeed before the consumer starts.

The work query selects only recorded abort decisions without completion; original preparation history stays intact. The consumer has the same project, polling, concurrency, scope/page and stop/drain bounds as publication recovery above. It does not create decisions or delete datasets. Only the original completion writer may mark ABORTED or reopen an applicable source gate after exact ownership, fresh health and unknown-write checks. The target gate remains closed.

The backend must honor the supplied AbortSignal before new stages/final authorization and drain actual external calls before `advance` resolves. The Runner coordinator validates its cleanup/finalizer identity tuple, propagates that signal through cleanup, data authority and finalization, and never replays an uncertain dispatched stage. Data Worker timeout/exit retains unfinished authority RPCs and its slot until they return. This cannot forcibly cancel an unresponsive adapter; bounded external I/O and external resource lifecycle remain the caller’s responsibility.
