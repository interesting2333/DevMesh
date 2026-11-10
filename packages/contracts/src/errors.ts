import { z } from 'zod';
import { ids } from './primitives.js';

export const errorCode = z.enum(['SCHEMA_INVALID', 'PRECONDITION_REQUIRED', 'PRECONDITION_FAILED', 'BASIS_SUPERSEDED', 'PLAN_SUPERSEDED', 'PERMIT_REVOKED', 'PERMIT_EXPIRED', 'PERMIT_SCOPE_DENIED', 'IDEMPOTENCY_KEY_REUSED', 'AUTHENTICATION_REQUIRED', 'FORBIDDEN', 'RESOURCE_NOT_FOUND', 'ACTIVE_RUN_EXISTS', 'LIMIT_EXCEEDED', 'OUTCOME_UNKNOWN', 'SERVICE_UNAVAILABLE',
  'IDENTITY_NOT_CONFIGURED','REQUEST_ORIGIN_INVALID','REQUEST_HEADERS_INVALID','REQUEST_HOST_INVALID','COOKIE_AUTH_NOT_CONFIGURED','SERVICE_STOPPING','CONTENT_TYPE_INVALID','REQUEST_TOO_LARGE','JSON_INVALID','UPLOAD_CAPACITY','UPLOAD_IN_PROGRESS','UPLOAD_FAILED','UPLOAD_TIMEOUT','UPLOAD_INTERRUPTED','UPLOAD_TOO_LARGE','UPLOAD_INVALID','UPLOAD_RESULT_INVALID','MULTIPART_INVALID','ATTACHMENT_TYPE_INVALID','ATTACHMENT_ENCODING_INVALID','ATTACHMENT_EMPTY','ATTACHMENT_BOUND','UPLOAD_CONTENT_CONFLICT','UPLOAD_HASH_INVALID','UPLOAD_CLAIM_INVALID','OPERATION_SCOPE_INVALID','ACCEPTED_RELEASE_CHANGED','MESSAGE_KEY_REUSED','RUN_NOT_WRITABLE','EVENT_CURSOR_INVALID','CONTENT_UNAVAILABLE']);
export type ErrorCode = z.infer<typeof errorCode>;
export const errorEnvelope = z.strictObject({ error: z.strictObject({
  code: errorCode, message: z.string().min(1), requestId: ids.request, retryable: z.boolean(),
  details: z.record(z.string(), z.json()),
}) });
export class ContractError extends Error {
  constructor(public readonly code: ErrorCode, public readonly status: 400 | 401 | 403 | 404 | 409 | 412 | 422 | 428 | 429 | 503, message: string, public readonly details: Record<string, z.infer<ReturnType<typeof z.json>>> = {}) {
    super(message);
    this.name = 'ContractError';
  }

  toEnvelope(requestId: string): z.infer<typeof errorEnvelope> {
    return errorEnvelope.parse({ error: { code: this.code, message: this.message, requestId, retryable: false, details: this.details } });
  }
}

export function parseContract<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ContractError('SCHEMA_INVALID', 422, '请求不符合契约。', {
    issues: result.error.issues.map(issue => ({ path: issue.path.map(String).join('.'), code: issue.code, message: issue.message })),
  });
}
