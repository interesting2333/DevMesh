import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { schemas, ids, parseContract, ContractError, assertPermit, assertResourceVersion, assertContentBasis, commandBodies, domainEvent, ephemeralTokenDelta, roleOutput, workRevision, createOpenApiDocument, inputText, projectName, taskTitle } from '../packages/contracts/dist/index.js';

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const valid = readJson('../packages/contracts/examples/valid.json');
const invalid = readJson('../packages/contracts/examples/invalid.json');
const sample = schema => structuredClone(valid.find(example => example.schema === schema).input);
const workflow = valid.find(e => e.schema === 'ExecutionPermit' && e.input.ownerKind === 'workflowAttempt').input;
const invocation = valid.find(e => e.schema === 'ExecutionPermit' && e.input.ownerKind === 'invocationAttempt').input;
const now = Date.parse('2026-11-10T08:00:05.000Z');
const hash = 'a'.repeat(64);
const rejected = (action, code, status) => assert.throws(action, error => error instanceof ContractError && error.code === code && error.status === status);

test('checked-in positive and negative examples are executable contracts', () => {
  for (const example of valid) assert.deepEqual(parseContract(schemas[example.schema], example.input), example.input, example.schema);
  for (const example of invalid) rejected(() => parseContract(schemas[example.schema], example.input), 'SCHEMA_INVALID', 422);
  assert.deepEqual(new Set(valid.filter(e => Object.hasOwn(commandBodies, e.schema)).map(e => e.schema)), new Set(Object.keys(commandBodies)));
});

test('ID namespaces, safe revisions and version literals cannot be coerced', () => {
  assert.equal(ids.run.safeParse('prj_01').success, false);
  assert.equal(ids.run.safeParse('run_../escape').success, false);
  for (const bad of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1']) rejected(() => parseContract(commandBodies.ConfirmPlan, { requirementRevision: bad, reviewHash: hash }), 'SCHEMA_INVALID', 422);
  for (const value of [undefined, null, [], { ...sample('Command'), schemaVersion: '1' }, { ...sample('Command'), type: 'Unknown' }]) rejected(() => parseContract(schemas.Command, value), 'SCHEMA_INVALID', 422);
});

test('schema errors retain field paths in a safe standard envelope', () => {
  try { parseContract(commandBodies.AnswerQuestions, { answers: [{ questionId: 'question_01', questionRevision: 'old', value: true }] }); assert.fail(); }
  catch (error) {
    assert.ok(error instanceof ContractError);
    assert.equal(error.toEnvelope('req_01').error.details.issues[0].path, 'answers.0.questionRevision');
    assert.equal(error.toEnvelope('req_01').error.retryable, false);
  }
});

test('input and display names count Unicode code points at exact boundaries', () => {
  for (const [schema, limit] of [[inputText, 20000], [projectName, 80], [taskTitle, 120]]) {
    assert.equal(schema.safeParse('😀'.repeat(limit)).success, true);
    assert.equal(schema.safeParse('😀'.repeat(limit + 1)).success, false);
    assert.equal(schema.safeParse('').success, false);
  }
  const input = sample('CreateProject');
  assert.equal(commandBodies.CreateProject.safeParse({ ...input, initialRequest: { ...input.initialRequest, attachmentIds: ['attachment_1', 'attachment_2', 'attachment_3', 'attachment_4'] } }).success, false);
});

test('conditional requests require a current single strong safe ETag', () => {
  assertResourceVersion('"r17"', 17);
  rejected(() => assertResourceVersion(undefined, 17), 'PRECONDITION_REQUIRED', 428);
  for (const tag of ['"r16"', 'W/"r17"', '*', '"r17", "r18"', 'r17', '"r017"', '"r9007199254740992"', '']) rejected(() => assertResourceVersion(tag, 17), 'PRECONDITION_FAILED', 412);
});

test('a current resource ETag cannot validate old business content or another review', () => {
  const current = { revision: 4, reviewHash: hash };
  assertContentBasis(current, current, 'plan');
  rejected(() => assertContentBasis({ ...current, revision: 3 }, current, 'plan'), 'PLAN_SUPERSEDED', 409);
  rejected(() => assertContentBasis({ ...current, reviewHash: 'b'.repeat(64) }, current), 'BASIS_SUPERSEDED', 409);
});

test('both execution owners work only within the authority scope', () => {
  assert.equal(assertPermit(workflow, workflow, { ...workflow.resources[0], access: 'read' }, now).ownerKind, 'workflowAttempt');
  assert.equal(assertPermit(invocation, invocation, invocation.resources[0], now).ownerKind, 'invocationAttempt');
  rejected(() => assertPermit(workflow, invocation, invocation.resources[0], now), 'PERMIT_REVOKED', 403);
  rejected(() => assertPermit(invocation, workflow, workflow.resources[0], now), 'PERMIT_REVOKED', 403);
});

test('host IDs, epochs, attempts, activation and grant are all current facts', () => {
  const variants = [
    ['runId', 'run_other'], ['runEpoch', 3], ['workId', 'work_other'], ['workEpoch', 4],
    ['attemptId', 'attempt_other'], ['activationId', 'activation_other'], ['grantId', 'grant_other'],
  ];
  for (const [key, value] of variants) rejected(() => assertPermit({ ...workflow, [key]: value }, workflow, workflow.resources[0], now), 'PERMIT_REVOKED', 403);
  for (const [key, value] of [['invocationId', 'invocation_other'], ['invocationEpoch', 3], ['invocationAttemptId', 'iattempt_other']]) rejected(() => assertPermit({ ...invocation, [key]: value }, invocation, invocation.resources[0], now), 'PERMIT_REVOKED', 403);
});

test('validity is half-open and cannot be widened by caller JSON', () => {
  assertPermit(workflow, workflow, workflow.resources[0], Date.parse(workflow.notBefore));
  for (const clock of [Date.parse(workflow.notBefore) - 1, Date.parse(workflow.expiresAt)]) rejected(() => assertPermit(workflow, workflow, workflow.resources[0], clock), 'PERMIT_EXPIRED', 403);
  rejected(() => assertPermit({ ...workflow, expiresAt: '2026-11-10T08:01:00.000Z' }, workflow, workflow.resources[0], now), 'PERMIT_REVOKED', 403);
  assert.throws(() => assertPermit(workflow, workflow, workflow.resources[0], NaN), TypeError);
});

test('forged scope and read-to-write escalation are denied', () => {
  rejected(() => assertPermit(workflow, workflow, { ...workflow.resources[0], resourceId: 'workspace_other' }, now), 'PERMIT_SCOPE_DENIED', 403);
  rejected(() => assertPermit({ ...workflow, resources: [...workflow.resources, { kind: 'dataset', resourceId: 'dataset_other', access: 'write' }] }, workflow, workflow.resources[0], now), 'PERMIT_SCOPE_DENIED', 403);
  rejected(() => assertPermit(invocation, invocation, { ...invocation.resources[0], access: 'write' }, now), 'PERMIT_SCOPE_DENIED', 403);
  rejected(() => assertPermit({ ...invocation, resources: [{ ...invocation.resources[0], access: 'write' }] }, invocation, invocation.resources[0], now), 'SCHEMA_INVALID', 422);
});

test('command target and payload are discriminated independently of client intent', () => {
  const cmd = sample('Command');
  rejected(() => parseContract(schemas.Command, { ...cmd, target: { kind: 'run', projectId: 'prj_01', runId: 'run_01' } }), 'SCHEMA_INVALID', 422);
  rejected(() => parseContract(schemas.Command, { ...cmd, payload: sample('AcceptCandidate') }), 'SCHEMA_INVALID', 422);
});

test('event time fallback, persisted versions and host fields cannot contradict payload', () => {
  const event = sample('DomainEvent');
  const validFallback = { ...event, timeSource: 'observed', occurredAt: event.observedAt };
  parseContract(domainEvent, validFallback);
  for (const bad of [{ ...event, timeSource: 'observed' }, { ...event, payload: { ...event.payload, attemptId: 'attempt_other' } }, { ...event, type: 'PlanConfirmed', payload: { planRevision: 2, decisionId: 'decision_01' } }]) rejected(() => parseContract(domainEvent, bad), 'SCHEMA_INVALID', 422);
});

test('token deltas do not become durable business events', () => {
  const token = { kind: 'token-delta', streamId: 'stream_01', text: '正在分析' };
  parseContract(ephemeralTokenDelta, token);
  rejected(() => parseContract(domainEvent, token), 'SCHEMA_INVALID', 422);
  rejected(() => parseContract(ephemeralTokenDelta, { ...token, seq: 5 }), 'SCHEMA_INVALID', 422);
});

test('A2A completed, findings and business success have different representations', () => {
  const event = sample('DomainEvent');
  parseContract(domainEvent, { ...event, type: 'A2ATaskObserved', payload: { attemptId: 'attempt_01', endpointId: 'builtin.tester', taskId: 'remote-protocol-id', state: 'completed' } });
  rejected(() => parseContract(domainEvent, { ...event, payload: { attemptId: 'attempt_01', state: 'completed' } }), 'SCHEMA_INVALID', 422);
  const result = parseContract(roleOutput, sample('TesterOutput'));
  assert.equal(result.caseResults[0].status, 'FAILED');
  assert.equal(Object.hasOwn(result, 'accepted'), false);
});

test('reports must bind one exact commit, including optional preview', () => {
  const tester = sample('TesterOutput');
  rejected(() => parseContract(roleOutput, { ...tester, previewRef: { ...tester.buildRef, targetCommit: 'e'.repeat(40) } }), 'SCHEMA_INVALID', 422);
  rejected(() => parseContract(roleOutput, { ...tester, coverageRef: null }), 'SCHEMA_INVALID', 422);
});

test('plan data has a scale limit and cannot embed a JavaScript completion checker', () => {
  const plan = sample('ArchitectOutput').planDraft;
  rejected(() => parseContract(schemas.PlanDraft, { ...plan, works: Array(31).fill(plan.works[0]) }), 'SCHEMA_INVALID', 422);
  rejected(() => parseContract(workRevision, { ...plan.works[0], completionChecks: [{ kind: 'script', code: 'return true' }] }), 'SCHEMA_INVALID', 422);
});

test('OpenAPI body references and route parameters resolve to shared schemas', () => {
  const document = createOpenApiDocument();
  assert.equal(document.openapi, '3.1.0');
  assert.equal(Object.keys(document.paths).length, 85);
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      assert.match(value.$ref, /^#\//);
      const target = value.$ref.slice(2).split('/').reduce((node, part) => node?.[part.replaceAll('~1', '/').replaceAll('~0', '~')], document);
      assert.ok(target, value.$ref);
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(document);
  const delivery=document.paths['/api/v1/projects/{projectId}/runs/{runId}/delivery'];
  assert.deepEqual(Object.keys(delivery),['get']);
  assert.equal(delivery.get.responses['200'].content['application/json'].schema.$ref,'#/components/schemas/WorkbenchDelivery');
  assert.deepEqual(delivery.get.parameters.filter(p=>p.in==='query').map(p=>p.name),['afterRevision','selectedCandidateId','limit']);
  assert.equal(delivery.get.parameters.find(p=>p.name==='limit').schema.maximum,20);
  for(const suffix of ['view','client.js'])assert.deepEqual(Object.keys(document.paths['/api/v1/runs/{runId}/candidates/{candidateId}/acceptance/'+suffix]),['get']);
  assert.deepEqual(Object.keys(document.paths['/api/v1/workbench/return-client.js']),['get']);
  for (const [path, methods] of Object.entries(document.paths)) for(const [method,operation] of Object.entries(methods)) {
    const implemented=['ReadWorkbenchPage','ReadWorkbenchClient','ReadWorkbenchReturnClient','ReadWorkbenchSource','ReadWorkbenchDelivery','ReadAcceptancePage','ReadAcceptanceClient','ReadCandidatePreviewManagementPage','ReadCandidatePreviewManagementClient','ReadCandidatePreviewWorkspace','CreatePreviewDataset','ReadCandidatePreviewDataset','CreatePreviewIntent','ReadCandidateManagedPreview','StopPreviewIntent','ReadAcceptanceBasis','ListCandidateAcceptancePreparations','BeginAcceptance','ConfirmAcceptanceReplacement','ReadAcceptancePreparation','CloseUnsentAcceptance','AbortAcceptance','AcceptCandidate','CreateProject','SaveMessage','CreateTask','ListProjects','ReadWorkspace','ReadEvents','LookupInputOperation','ReadInputOperation','UploadAttachment','ReadAttachment','RemoveAttachment','ReadAttachmentContent','ReadUnderstanding','AnswerQuestions','RetryUnderstanding','ReadPlan','ConfirmPlan','ReadPreviewEntry','IssuePreviewAccess','ReadPreviewPage','ReadReleaseEntry','IssueReleaseAccess','ReadReleasePage','DownloadFrozenMaterial','CreateReleaseExport','ListReleaseExports','ReadReleaseExport','ReadReleaseExportPage','ReadReleaseExportClient','ReadCandidateReview','RecordCandidateReview','RecordCandidateRejection','ReadCandidateReviewHistory','ReadCandidateRejectionHistory','ReadCandidateReviewPage','ReadCandidateReviewClient','RetryReleaseExport','DownloadReleaseExport','ReadRunControlStatus','ReadChangeProposals','ReadChangeProposal','ReadConfigAdjustments','ReadConfigAdjustment','ReadConfigGeneration','ReadInvocations','ReadInvocation','TransitionInvocation','ReadContentPins','ReleaseContentPin','ReadStorageDiagnostics','ReadPublicTasks','ClaimPublicTask','ReadPublicTask','CompletePublicTask','ReadContentArchives','ReadContentArchive','AckContentArchive','ReadProjectStats','ExportProjectConfig'].includes(operation.operationId);
    assert.equal(operation['x-implementation-status'], implemented?'implemented-offline':'planned');
    assert.deepEqual(new Set([...path.matchAll(/\{([^}]+)\}/g)].map(m => m[1])), new Set(operation.parameters.filter(p => p.in === 'path').map(p => p.name)));
    if(['CreatePreviewDataset','CreatePreviewIntent'].includes(operation.operationId))assert.ok(operation.parameters.find(p=>p.name==='If-Match'&&p.required));
    if(operation.operationId==='StopPreviewIntent'){assert.equal(operation.parameters.some(p=>p.name==='If-Match'),false);assert.equal(operation.requestBody.content['application/json'].schema.$ref,'#/components/schemas/StopPreviewIntent');}
    if(['IssuePreviewAccess','IssueReleaseAccess'].includes(operation.operationId)){
      assert.ok(operation.parameters.find(p=>p.in==='header'&&p.name==='Origin'&&p.required));
      assert.equal(operation.parameters.some(p=>p.name==='Idempotency-Key'),false);
      const prefix=operation.operationId==='IssuePreviewAccess'?'Preview':'Release';
      assert.equal(operation.requestBody.content['application/json'].schema.$ref,`#/components/schemas/${prefix}AccessInput`);
      assert.equal(operation.responses['200'].content['application/json'].schema.$ref,`#/components/schemas/${prefix}AccessTicket`);
    }else if(operation.operationId==='RetryReleaseExport'){
      assert.equal(operation.requestBody.content['application/json'].schema.$ref,'#/components/schemas/RetryReleaseExport');
      assert.equal(operation.parameters.some(p=>p.name==='Idempotency-Key'),false);
    }else if(method==='post')assert.ok(operation.parameters.find(p => p.name === 'Idempotency-Key' && p.required));
  }
  assert.deepEqual(readJson('../packages/contracts/openapi.json'), document);
});

test('OpenAPI drift check returns a real process success for the generated artifact', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const child = spawnSync(process.execPath, ['scripts/contracts.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /matches/);
});
