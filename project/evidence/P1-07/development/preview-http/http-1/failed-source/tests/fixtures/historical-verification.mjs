import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {canonical,hash} from './storage-data.mjs';

// Deliberate pre-P1-06 DB fixture for scheduler/source-basis tests. This does not
// call or bypass the production verifier and is never evidence of verification.
// Retain the original operation too, so historical replay is tested separately
// from authorization of any NEW completion request.
export function seedHistoricalVerification(database,input){
 const owns=typeof database==='string',db=owns?new DatabaseSync(database):database;
 try{
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
  const {meta,...payload}=input,attempt=db.prepare('SELECT * FROM attempts WHERE attempt_id=? AND run_id=?').get(input.attemptId,input.runId);
  if(!attempt||attempt.state!=='VERIFYING'||attempt.ended_at!==null)throw Error('Historical fixture requires a verifying attempt');
  const time=new Date().toISOString(),state=input.outcome==='success'?'SUCCEEDED':'FAILED',operationId='op_'+randomUUID().replaceAll('-','');
  db.prepare('INSERT INTO verified_work_results VALUES(?,?,?,?,?,?)').run(input.attemptId,input.outcome,input.evidence.artifactId,canonical(input.outputs),input.codeCommit,time);
  db.prepare('UPDATE attempts SET state=?,ended_at=? WHERE attempt_id=?').run(state,time,input.attemptId);
  db.prepare('DELETE FROM role_slots WHERE attempt_id=?').run(input.attemptId);
  db.prepare("UPDATE execution_grants SET status='REVOKED' WHERE attempt_id=?").run(input.attemptId);
  db.prepare('UPDATE runs SET resource_revision=resource_revision+1 WHERE run_id=?').run(input.runId);
  const result={attemptId:input.attemptId,state,revision:db.prepare('SELECT resource_revision FROM runs WHERE run_id=?').get(input.runId).resource_revision};
  db.prepare("INSERT INTO operations VALUES(?,?,?,?,?,?,'SUCCEEDED',?,?,?)").run(operationId,meta.principalId,meta.scopeId,meta.idempotencyKey,hash(canonical({kind:'RecordVerifiedWork',payload})),'RecordVerifiedWork',canonical(result),time,time);
  db.exec('COMMIT');return {operationId,status:'SUCCEEDED',result};
 }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}finally{if(owns)db.close();}
}
