import {planAdmissionTable} from './plan-admissions.js';
import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract} from '@devmesh/contracts';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
import {toolRequests} from './tool-protocol.js';
import type {IssueOperation,IssueView,ToolInput,ToolMethod} from './tool-protocol.js';
import {createToolAuthorityDomain} from './tool-authority-domain.js';

type Row=Record<string,string|number|null>;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Issue command could not be applied');}
export function createToolDomain(db:DatabaseSync,changed:(runId:string,operationId:string,attemptId:string,payload:Record<string,unknown>)=>void){
  const authority=createToolAuthorityDomain(db);
  const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined;
  const all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[];
  const exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
  const ready=(runId:string,ref:{artifactId:string;sha256:string})=>{
    if(!get(`SELECT 1 FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash
      WHERE a.run_id=? AND a.artifact_id=? AND a.content_hash=? AND a.state='READY' AND c.state='READY'`,runId,ref.artifactId,ref.sha256))fail('ISSUE_EVIDENCE_UNAVAILABLE',422);
  };
  const result=(r:Row):IssueOperation=>({operationId:String(r.operation_id),toolName:String(r.tool_name),issueId:String(r.issue_id),issueRevision:Number(r.issue_revision),state:'SUCCEEDED'});
  function original(input:ToolInput<'getIssueOperation'>){
    authority.check(input.permit,'issues.by-operation','read');
    if(input.permit.ownerKind!=='workflowAttempt')fail('MCP_AUTHORITY_DENIED',403);
    const r=get('SELECT * FROM issue_operations WHERE operation_id=? AND run_id=? AND attempt_id=? AND activation_id=? AND grant_id=?',input.operationId,input.permit.runId,input.permit.attemptId,input.permit.activationId,input.permit.grantId);
    return r;
  }
  function mutation(input:ToolInput<'createIssue'>|ToolInput<'linkIssueFix'>|ToolInput<'recordIssueVerification'>,toolName:string,kind:string,act:(host:ReturnType<typeof authority.check>)=>Row){
    return transaction(db,()=>{
      const prior=original(input),requestHash=digest(canonical({toolName,args:input.args}));
      if(prior){if(prior.request_hash!==requestHash||prior.tool_name!==toolName)fail('IDEMPOTENCY_KEY_REUSED');return result(prior);}
      if(get('SELECT 1 FROM issue_operations WHERE operation_id=?',input.operationId))fail('MCP_AUTHORITY_DENIED',403);
      const host=authority.check(input.permit,toolName,'write'),r=act(host),time=new Date().toISOString(),p=input.permit;
      if(p.ownerKind!=='workflowAttempt')fail('MCP_AUTHORITY_DENIED',403);
      exec('INSERT INTO issue_operations VALUES(?,?,?,?,?,?,?,?,?,?)',input.operationId,p.runId,p.attemptId,p.activationId,p.grantId,toolName,requestHash,r.issue_id!,r.revision!,time);
      const args=input.args;
      exec('INSERT INTO issue_revisions VALUES(?,?,?,?,?,?,?,?,?)',r.issue_id!,r.revision!,input.operationId,kind,canonical(args),
        'evidence' in args?args.evidence.artifactId:null,'fixAttemptId' in args?args.fixAttemptId:null,
        'verificationAttemptId' in args?args.verificationAttemptId:null,time);
      changed(p.runId,get('SELECT 1 FROM operations WHERE operation_id=?',input.operationId)?input.operationId:String(host.host.dispatch_operation_id),p.attemptId,
        {issueId:r.issue_id,issueRevision:r.revision,toolOperationId:input.operationId,toolName});
      return result(get('SELECT * FROM issue_operations WHERE operation_id=?',input.operationId)!);
    });
  }
  const current=(runId:string,id:string,revision:number)=>{
    const r=get('SELECT * FROM issues WHERE issue_id=? AND run_id=?',id,runId);if(!r)fail('ISSUE_NOT_FOUND',404);
    if(r.revision!==revision)fail('ISSUE_REVISION_CHANGED');return r;
  };
  const handlers={
    authorizeMcpAction(input:ToolInput<'authorizeMcpAction'>){return transaction(db,()=>{const {host:_host,...publicValue}=authority.check(input.permit,input.toolName,input.action);return publicValue;});},
    refreshMcpPermit(input:ToolInput<'refreshMcpPermit'>){return transaction(db,()=>authority.refresh(input.permit,input.toolName,input.action));},
    createIssue(input:ToolInput<'createIssue'>){return mutation(input,'issues.create','CREATED',h=>{
      ready(h.runId,input.args.evidence);const id='issue_'+randomUUID().replaceAll('-',''),time=new Date().toISOString();
      exec("INSERT INTO issues VALUES(?,?,?,?,1,'OPEN',?,?,?,?,NULL,?,?)",id,h.projectId,h.runId,h.host.attempt_id!,input.args.title,input.args.description,input.args.severity,input.args.evidence.artifactId,time,time);
      return get('SELECT * FROM issues WHERE issue_id=?',id)!;
    });},
    linkIssueFix(input:ToolInput<'linkIssueFix'>){return mutation(input,'issues.linkFix','FIX_LINKED',h=>{
      const a=input.args,r=current(h.runId,a.issueId,a.issueRevision);
      if(get('SELECT 1 FROM verified_findings WHERE issue_id=?',a.issueId))fail('ISSUE_TRUSTED_COMMAND_REQUIRED');
      if(r.state==='VERIFIED')fail('ISSUE_ALREADY_VERIFIED');
      if(!get(`SELECT 1 FROM works w JOIN runs r ON r.run_id=w.run_id JOIN plan_works p ON p.run_id=w.run_id AND p.work_id=w.work_id AND p.plan_revision=r.current_plan_revision
        JOIN ${planAdmissionTable(db)} c ON c.run_id=r.run_id AND c.plan_revision=p.plan_revision AND c.requirement_revision=r.current_requirement_revision
        JOIN work_revisions v ON v.run_id=p.run_id AND v.work_id=p.work_id AND v.revision=p.work_revision WHERE w.run_id=? AND w.work_id=? AND v.role='developer'`,h.runId,a.fixWorkId))fail('ISSUE_FIX_WORK_INVALID',422);
      exec("UPDATE issues SET revision=revision+1,state='FIX_LINKED',fix_work_id=?,updated_at=? WHERE issue_id=?",a.fixWorkId,new Date().toISOString(),a.issueId);
      return get('SELECT * FROM issues WHERE issue_id=?',a.issueId)!;
    });},
    recordIssueVerification(input:ToolInput<'recordIssueVerification'>){return mutation(input,'issues.recordVerification','VERIFICATION_RECORDED',h=>{
      const a=input.args,r=current(h.runId,a.issueId,a.issueRevision);ready(h.runId,a.evidence);
      if(get('SELECT 1 FROM verified_findings WHERE issue_id=?',a.issueId))fail('ISSUE_TRUSTED_COMMAND_REQUIRED');
      const fix=get('SELECT * FROM attempts WHERE attempt_id=? AND run_id=? AND work_id=?',a.fixAttemptId,h.runId,r.fix_work_id??null);
      if(!fix)fail('ISSUE_FIX_ATTEMPT_INVALID',422);
      if(a.outcome!=='NOT_VERIFIED'){
        const dev=get('SELECT * FROM verified_work_results WHERE attempt_id=? AND outcome=\'success\'',a.fixAttemptId);
        const verification=get(`SELECT v.*,t.role,t.input_manifest_json,t.ended_at,t.state FROM verified_work_results v
          JOIN attempts t ON t.attempt_id=v.attempt_id WHERE t.attempt_id=? AND t.run_id=?`,a.verificationAttemptId,h.runId);
        const expected=a.outcome==='PASSED'?'success':'completed-with-findings';
        if(!dev?.code_commit||!verification||verification.role!=='tester'||verification.ended_at===null||verification.outcome!==expected||
          verification.state!==(a.outcome==='PASSED'?'SUCCEEDED':'FAILED')||verification.evidence_artifact_id!==a.evidence.artifactId||
          (JSON.parse(String(verification.input_manifest_json)) as {codeCommit:string}).codeCommit!==dev.code_commit)fail('ISSUE_VERIFICATION_UNPROVEN',422);
      }
      exec('UPDATE issues SET revision=revision+1,state=?,updated_at=? WHERE issue_id=?',a.outcome==='PASSED'?'VERIFIED':'FIX_LINKED',new Date().toISOString(),a.issueId);
      return get('SELECT * FROM issues WHERE issue_id=?',a.issueId)!;
    });},
    getIssue(input:ToolInput<'getIssue'>):IssueView{
      return transaction(db,()=>{const h=authority.check(input.permit,'issues.get','read'),r=get('SELECT * FROM issues WHERE issue_id=? AND run_id=?',input.issueId,h.runId);
        if(!r)fail('ISSUE_NOT_FOUND',404);
        const revisions=all('SELECT * FROM issue_revisions WHERE issue_id=? AND revision>? ORDER BY revision LIMIT ?',input.issueId,input.afterRevision,input.limit+1),page=revisions.slice(0,input.limit);
        return {issueId:String(r.issue_id),projectId:String(r.project_id),runId:String(r.run_id),sourceAttemptId:String(r.source_attempt_id),revision:Number(r.revision),state:String(r.state),title:String(r.title),description:String(r.description),severity:String(r.severity),fixWorkId:r.fix_work_id as string|null,
          history:page.map(x=>({revision:Number(x.revision),kind:String(x.kind),operationId:String(x.operation_id),value:JSON.parse(String(x.value_json)) as unknown,createdAt:String(x.created_at)})),
          nextRevision:revisions.length>input.limit?Number(page.at(-1)!.revision):null};});
    },
    getIssueOperation(input:ToolInput<'getIssueOperation'>){return transaction(db,()=>{const r=original(input);if(!r)fail('ISSUE_OPERATION_NOT_FOUND',404);return result(r);});},
  };
  return {execute(method:ToolMethod,input:unknown){const p=parseContract(toolRequests[method],input);return (handlers[method] as (p:unknown)=>unknown)(p);}};
}
