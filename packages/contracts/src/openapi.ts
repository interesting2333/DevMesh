import { z } from 'zod';
import { ids, revision, runState, attemptState, invocationState, jobState, operationStatus, a2aTaskState, inputText, projectName, taskTitle } from './primitives.js';
import { command, commandBodies, operationReceipt, idempotencyKey } from './commands.js';
import { domainEvent, ephemeralTokenDelta } from './events.js';
import { executionPermit, executionOwner } from './permits.js';
import { roleOutput, productOutput, architectOutput, developerOutput, testerOutput, workRevision, planDraft, workDelegation, invocationDelegation, inputManifest } from './outputs.js';
import { errorEnvelope } from './errors.js';
import { strongETag, contentBasis } from './versions.js';

export const schemas = {
  Command: command, DomainEvent: domainEvent, EphemeralTokenDelta: ephemeralTokenDelta,
  ExecutionPermit: executionPermit, ExecutionOwner: executionOwner, RoleOutput: roleOutput,
  ProductOutput: productOutput, ArchitectOutput: architectOutput, DeveloperOutput: developerOutput, TesterOutput: testerOutput,
  WorkRevision: workRevision, PlanDraft: planDraft, WorkDelegation: workDelegation, InvocationDelegation: invocationDelegation,
  InputManifest: inputManifest, RunState: runState, AttemptState: attemptState, InvocationState: invocationState,
  JobState: jobState, OperationStatus: operationStatus, A2ATaskState: a2aTaskState,
  OperationReceipt: operationReceipt, ErrorEnvelope: errorEnvelope, StrongETag: strongETag, ContentBasis: contentBasis,
  InputText: inputText, ProjectName: projectName, TaskTitle: taskTitle,
  ...commandBodies,
};

export const commandRoutes = [
  { name: 'CreateProject', path: '/api/v1/projects', parameters: {}, conditional: false, success: ['201'] },
  { name: 'SaveMessage', path: '/api/v1/runs/{runId}/messages', parameters: { runId: ids.run }, conditional: true, success: ['202'] },
  { name: 'AnswerQuestions', path: '/api/v1/runs/{runId}/questions:answer', parameters: { runId: ids.run }, conditional: true, success: ['202'] },
  { name: 'ConfirmPlan', path: '/api/v1/runs/{runId}/plans/{revision}:confirm', parameters: { runId: ids.run, revision }, conditional: true, success: ['202'] },
  { name: 'PlanFeedback', path: '/api/v1/runs/{runId}/plans/{revision}:feedback', parameters: { runId: ids.run, revision }, conditional: true, success: ['202'] },
  { name: 'ProposeChange', path: '/api/v1/runs/{runId}/changes', parameters: { runId: ids.run }, conditional: true, success: ['202'] },
  { name: 'DecideChange', path: '/api/v1/changes/{changeId}:decide', parameters: { changeId: ids.change }, conditional: true, success: ['200', '202'] },
  { name: 'PauseRun', path: '/api/v1/runs/{runId}:pause', parameters: { runId: ids.run }, conditional: true, success: ['202'] },
  { name: 'ResumeRun', path: '/api/v1/runs/{runId}:resume', parameters: { runId: ids.run }, conditional: true, success: ['202'] },
  { name: 'CancelRun', path: '/api/v1/runs/{runId}:cancel', parameters: { runId: ids.run }, conditional: true, success: ['202'] },
  { name: 'RetryWork', path: '/api/v1/works/{workId}:retry', parameters: { workId: ids.work }, conditional: true, success: ['202'] },
  { name: 'RedoRun', path: '/api/v1/runs/{runId}:redo', parameters: { runId: ids.run }, conditional: true, success: ['202'] },
  { name: 'AcceptCandidate', path: '/api/v1/candidates/{candidateId}:accept', parameters: { candidateId: ids.candidate }, conditional: true, success: ['202'] },
] as const;

const jsonSchema = (schema: z.ZodType, componentName?: string) => {
  const { $schema: _dialect, ...value } = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' });
  // Zod's recursive JSON values use root-local $defs. Embedded components need
  // document-root pointers, otherwise an OpenAPI consumer resolves the wrong root.
  const rebase = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.$ref === 'string' && record.$ref.startsWith('#/$defs/')) {
      if (!componentName) throw new Error('Recursive schema requires a named OpenAPI component');
      record.$ref = `#/components/schemas/${componentName}/${record.$ref.slice(2)}`;
    }
    for (const child of Object.values(node)) rebase(child);
  };
  rebase(value);
  return value;
};
const content = (name: string) => ({ 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } });

export function createOpenApiDocument() {
  const paths = Object.fromEntries(commandRoutes.map(route => [route.path, { post: {
    operationId: route.name, 'x-implementation-status': 'planned',
    description: 'P0-02 契约。业务 handler 尚未实现。先认证、权限和原操作去重，再校验新操作版本；202 仅为持久受理。',
    security: [{ browserSession: [] }],
    parameters: [
      ...Object.entries(route.parameters).map(([name, schema]) => ({ name, in: 'path', required: true, schema: jsonSchema(schema) })),
      { name: 'Idempotency-Key', in: 'header', required: true, schema: jsonSchema(idempotencyKey) },
      ...(route.conditional ? [{ name: 'If-Match', in: 'header', required: true, schema: jsonSchema(strongETag) }] : []),
    ],
    requestBody: { required: true, content: content(route.name) },
    responses: Object.fromEntries([
      ...route.success.map(status => [status, { description: status === '201' ? '创建事务提交' : status === '202' ? '持久受理，后台结果另查' : '已保存结果', content: content('OperationReceipt') }]),
      ...['401', '403', '404', '409', '412', '422', '428', '429', '503'].filter(status => route.conditional || !['412', '428'].includes(status)).map(status => [status, { description: ({ '401': '未认证', '403': '权限不足', '404': '资源不存在或不可见', '409': '业务依据或原操作冲突', '412': '资源版本不匹配', '422': '非法 schema', '428': '缺失版本条件', '429': '限流', '503': '暂不可用，先查询原操作键' } as Record<string, string>)[status], content: content('ErrorEnvelope') }]),
    ]),
  } }]));
  return {
    openapi: '3.1.0', jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: { title: 'DevMesh 核心契约初版', version: '0.1.0', description: 'P0-02 共享契约及首批 13 个业务命令；所有 paths 均 planned。结构通过不等于事实验证、授权或人工接受。其余 D3 API 随工作包增量补齐。' },
    'x-runtime-constraints': ['permit 有效期顺序、宿主当前代际及资源范围', '测试成果所有报告绑定相同 SHA', '事件 envelope 与 payload 版本和归属一致', 'ETag 安全整数范围', 'DAG 无环、来源存在、ACL、幂等及事务由后续服务负责'],
    paths,
    components: {
      securitySchemes: { browserSession: { type: 'apiKey', in: 'cookie', name: 'devmesh_session', description: 'P1-01 待实现的浏览器 Session；不接收外部服务 token 作为内部 permit。CSRF 与 Origin 检查由 API 层负责。' } },
      schemas: Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, jsonSchema(schema, name)])),
    },
  };
}
