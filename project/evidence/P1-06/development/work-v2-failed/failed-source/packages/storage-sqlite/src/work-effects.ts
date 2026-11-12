import type {DatabaseSync} from 'node:sqlite';
/** Read original durable effects; no lease expiry is an exit receipt. */
export function knownAttemptEffects(db:DatabaseSync,attemptId:string):boolean{
 const pending=[
  "SELECT 1 FROM tool_operations t JOIN operations o ON o.operation_id=t.operation_id WHERE t.attempt_id=? AND o.status NOT IN ('SUCCEEDED','FAILED')",
  "SELECT 1 FROM runner_jobs j JOIN tool_operations t ON t.operation_id=j.operation_id WHERE t.attempt_id=? AND j.state<>'EXITED'",
  "SELECT 1 FROM pipelines WHERE attempt_id=? AND state NOT IN ('SUCCEEDED','FAILED','CANCELLED')",
   "SELECT 1 FROM pipeline_stages s JOIN pipelines p ON p.pipeline_id=s.pipeline_id WHERE p.attempt_id=? AND s.state NOT IN ('PENDING','SKIPPED','EXITED')",
  "SELECT 1 FROM runtime_tool_calls t JOIN runtime_activations a ON a.activation_id=t.activation_id WHERE a.attempt_id=? AND t.state NOT IN ('SUCCEEDED','FAILED')",
  "SELECT 1 FROM repo_operations WHERE attempt_id=? AND state NOT IN ('SUCCEEDED','FAILED')",
  "SELECT 1 FROM repo_file_operations WHERE attempt_id=? AND state NOT IN ('SUCCEEDED','FAILED')",
  "SELECT 1 FROM source_archives WHERE attempt_id=? AND state NOT IN ('ACKNOWLEDGED','FAILED')",
 ];
 return pending.every(sql=>!db.prepare(sql).get(attemptId));
}
