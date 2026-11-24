import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {assistantTaskView,assistantPath,assistantExecutionDetails,parseContract} from '@devmesh/contracts';
import type {AssistantExecutionDetails} from '@devmesh/contracts';
import {StorageError} from './errors.js';

type Row=Record<string,string|number|null>;
const json=(value:unknown):Record<string,unknown>=>value==null?{}:JSON.parse(String(value));
export function publicAssistantTask(s:Row){
 const r=json(s.result_json);
 return parseContract(assistantTaskView,{sessionId:s.session_id,inputRevision:s.input_revision,mode:s.mode,workspaceKind:r.workspaceKind??'BOUND',files:r.files??[],state:s.state,updatedAt:s.updated_at,changes:r.changes??[],checks:r.checks??[],verified:r.verified===true,applied:s.applied===1,error:s.error_code});
}
/** Project only authorized execution facts. Never return model requests, tool arguments or host paths. */
export function readAssistantExecutionDetails(db:DatabaseSync,conversationId:string,inputRevision:number,sessionId?:string):AssistantExecutionDetails{
 const all=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).all(...args) as Row[];
 const rows=all('SELECT * FROM assistant_sessions WHERE conversation_id=? ORDER BY created_at DESC,rowid DESC LIMIT 20',conversationId);
 const selected=sessionId?all('SELECT * FROM assistant_sessions WHERE conversation_id=? AND session_id=?',conversationId,sessionId)[0]:rows.find(s=>s.input_revision===inputRevision)??rows[0];
 if(sessionId&&!selected)throw new StorageError('RESOURCE_NOT_FOUND',404,'Execution does not belong to this conversation');
 // Only submitted inputs increment input_revision. Plan confirmations also have role=user.
 const inputs=all("SELECT text FROM conversation_messages WHERE conversation_id=? AND role='user' AND client_id IS NOT NULL ORDER BY seq",conversationId);
 const goalAt=(revision:number)=>String(inputs[revision-1]?.text??'');
 const previousResult=all(`
  SELECT session_id FROM assistant_sessions
  WHERE conversation_id=? AND input_revision<? AND state IN ('READY','BLOCKED','SUPERSEDED')
    AND (json_array_length(result_json,'$.files')>0 OR json_array_length(result_json,'$.changes')>0)
  ORDER BY input_revision DESC,created_at DESC,rowid DESC LIMIT 1
 `,conversationId,inputRevision)[0]?.session_id??null;
 const previousPreview=all(`
  SELECT session_id FROM assistant_sessions
  WHERE conversation_id=? AND input_revision<? AND state IN ('READY','BLOCKED','SUPERSEDED')
    AND json_extract(result_json,'$.workspaceKind')='GENERATED'
    AND EXISTS (SELECT 1 FROM json_each(result_json,'$.files')
      WHERE lower(json_extract(value,'$.path')) LIKE '%.html' OR lower(json_extract(value,'$.path')) LIKE '%.htm')
  ORDER BY input_revision DESC,created_at DESC,rowid DESC LIMIT 1
 `,conversationId,inputRevision)[0]?.session_id??null;
 const count=(table:string)=>Number(all('SELECT count(*) n FROM '+table+' WHERE session_id=?',selected!.session_id!)[0]!.n);
 let detail:AssistantExecutionDetails['selected']=null;
 if(selected){
  const id=selected.session_id!,steps=all('SELECT step_no,state,created_at,updated_at FROM assistant_steps WHERE session_id=? ORDER BY step_no DESC LIMIT 20',id),tools=all('SELECT operation_id,step_no,name,state,args_json,result_json,created_at,updated_at FROM assistant_tool_calls WHERE session_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200',id),applications=all('SELECT operation_id,state,created_at,updated_at FROM assistant_applications WHERE session_id=? ORDER BY created_at DESC LIMIT 20',id);
  const activities:NonNullable<AssistantExecutionDetails['selected']>['activities']=[{id:String(id),kind:'SESSION',state:String(selected.state),startedAt:String(selected.created_at),updatedAt:String(selected.updated_at)}];
  for(const s of steps)activities.push({id:String(id)+'-step-'+s.step_no,kind:'MODEL',stepNo:Number(s.step_no),state:String(s.state),startedAt:String(s.created_at),updatedAt:String(s.updated_at)});
  for(const t of tools){const args=json(t.args_json),result=json(t.result_json),path=assistantPath.safeParse(args.path);activities.push({id:String(t.operation_id),kind:'TOOL',tool:t.name as NonNullable<AssistantExecutionDetails['selected']>['activities'][number]['tool'],stepNo:Number(t.step_no),state:String(t.state),startedAt:String(t.created_at),updatedAt:String(t.updated_at),...(path.success?{path:path.data}:{}),...(t.name==='project_check'?{check:args.check as 'html'|'build'|'test'|'lint',exitCode:typeof result.exitCode==='number'?result.exitCode:null}:{})});}
  for(const a of applications)activities.push({id:String(a.operation_id),kind:'APPLICATION',state:String(a.state),startedAt:String(a.created_at),updatedAt:String(a.updated_at)});
  activities.sort((a,b)=>a.startedAt.localeCompare(b.startedAt)||(a.stepNo??0)-(b.stepNo??0)||a.id.localeCompare(b.id));
  const reply=all("SELECT text FROM conversation_messages WHERE conversation_id=? AND turn_id=? AND role='assistant' ORDER BY seq DESC LIMIT 1",conversationId,selected.turn_id!)[0]?.text??'';
  detail={task:publicAssistantTask(selected),createdAt:String(selected.created_at),goal:goalAt(Number(selected.input_revision)),reply:String(reply),modelSteps:count('assistant_steps'),toolCalls:count('assistant_tool_calls'),activities:activities.slice(-200),totalActivities:1+count('assistant_steps')+count('assistant_tool_calls')+count('assistant_applications')};
 }
 return parseContract(assistantExecutionDetails,{
  conversationId,currentInputRevision:inputRevision,currentGoal:goalAt(inputRevision),previousResult,previousPreview,
  sessionCount:Number(all('SELECT count(*) n FROM assistant_sessions WHERE conversation_id=?',conversationId)[0]!.n),
  sessions:rows.map(s=>{
   const t=publicAssistantTask(s);
   const goal=Array.from(goalAt(t.inputRevision).trim().replace(/\s+/gu,' ')).slice(0,58).join('');
   return {sessionId:t.sessionId,inputRevision:t.inputRevision,mode:t.mode,workspaceKind:t.workspaceKind,state:t.state,updatedAt:t.updatedAt,startedAt:s.created_at,goal};
  }),
  selected:detail,
 });
}
