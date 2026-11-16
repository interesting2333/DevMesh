import {beginAcceptanceInput,confirmAcceptanceReplacementInput,closeUnsentAcceptanceInput,abortAcceptanceInput,acceptanceBasisView,acceptancePreparationView,acceptancePreparationList,acceptanceReplacementReceipt,acceptanceAbortReceipt,acceptanceCommitReceipt} from './release-acceptance.js';
import { z } from 'zod';
import {candidateReviewEntry,candidateHumanResult,candidateRejectionResult,candidateReviewHistory,candidateRejectionHistory,recordCandidateReviewInput,recordCandidateRejectionInput} from './candidate-review.js';
import {createReleaseExportInput,retryReleaseExportInput,releaseExportView,releaseExportListView} from './release-export.js';
import { ids, revision, runState, attemptState, invocationState, jobState, operationStatus, a2aTaskState, inputText, projectName, taskTitle,opaqueKey } from './primitives.js';
import {releaseAccessInput,releaseAccessTicket,releaseEntryView} from './release-access.js';
import {previewAccessInput,previewAccessTicket,previewEntryView,candidatePreviewWorkspace,previewDatasetManagement,previewManagement,createPreviewDatasetInput,createPreviewIntentInput,stopPreviewIntentInput} from './preview.js';
import { command, commandBodies, operationReceipt, idempotencyKey } from './commands.js';
import { domainEvent, ephemeralTokenDelta } from './events.js';
import { executionPermit, executionOwner } from './permits.js';
import { roleOutput, productOutput, architectOutput, developerOutput, testerOutput, workRevision, planDraft, workDelegation, invocationDelegation, inputManifest } from './outputs.js';
import { errorEnvelope } from './errors.js';
import { strongETag, contentBasis } from './versions.js';
import { createTaskInput,uploadMetadata,attachmentView,inputOperation,inputOperationLookup,workspaceView,workbenchSourceView } from './input.js';
import { preparationDelegation,preparationInput,retryUnderstandingInput,understandingOutput,understandingView } from './preparation.js';
import { planReviewView } from './plans.js';
import {workbenchDeliveryView} from './workbench-delivery.js';

export const schemas = {
  BeginAcceptance:beginAcceptanceInput,ConfirmAcceptanceReplacement:confirmAcceptanceReplacementInput,CloseUnsentAcceptance:closeUnsentAcceptanceInput,AbortAcceptance:abortAcceptanceInput,AcceptanceBasis:acceptanceBasisView,AcceptancePreparation:acceptancePreparationView,AcceptancePreparationList:acceptancePreparationList,AcceptanceReplacementReceipt:acceptanceReplacementReceipt,AcceptanceAbortReceipt:acceptanceAbortReceipt,AcceptanceCommitReceipt:acceptanceCommitReceipt,
  CandidateReviewEntry:candidateReviewEntry,CandidateHumanResult:candidateHumanResult,CandidateRejectionResult:candidateRejectionResult,CandidateReviewHistory:candidateReviewHistory,CandidateRejectionHistory:candidateRejectionHistory,RecordCandidateReview:recordCandidateReviewInput,RecordCandidateRejection:recordCandidateRejectionInput,
  CreateReleaseExport:createReleaseExportInput,RetryReleaseExport:retryReleaseExportInput,ReleaseExport:releaseExportView,ReleaseExportList:releaseExportListView,
  Command: command, DomainEvent: domainEvent, EphemeralTokenDelta: ephemeralTokenDelta,
  ExecutionPermit: executionPermit, ExecutionOwner: executionOwner, RoleOutput: roleOutput,
  ProductOutput: productOutput, ArchitectOutput: architectOutput, DeveloperOutput: developerOutput, TesterOutput: testerOutput,
  WorkRevision: workRevision, PlanDraft: planDraft, WorkDelegation: workDelegation, InvocationDelegation: invocationDelegation,
  InputManifest: inputManifest, RunState: runState, AttemptState: attemptState, InvocationState: invocationState,
  JobState: jobState, OperationStatus: operationStatus, A2ATaskState: a2aTaskState,
  OperationReceipt: operationReceipt, ErrorEnvelope: errorEnvelope, StrongETag: strongETag, ContentBasis: contentBasis,
  InputText: inputText, ProjectName: projectName, TaskTitle: taskTitle,
  CreateTask:createTaskInput,UploadMetadata:uploadMetadata,Attachment:attachmentView,InputOperation:inputOperation,InputOperationLookup:inputOperationLookup,Workspace:workspaceView,
  Understanding:understandingView,UnderstandingOutput:understandingOutput,RetryUnderstanding:retryUnderstandingInput,
  PreparationDelegation:preparationDelegation,PreparationInput:preparationInput,
  PlanReview:planReviewView,
  WorkbenchSource:workbenchSourceView,
  WorkbenchDelivery:workbenchDeliveryView,
  ReleaseAccessInput:releaseAccessInput,ReleaseAccessTicket:releaseAccessTicket,ReleaseEntryView:releaseEntryView,
  PreviewAccessInput:previewAccessInput,PreviewAccessTicket:previewAccessTicket,PreviewEntryView:previewEntryView,
  CandidatePreviewWorkspace:candidatePreviewWorkspace,PreviewDatasetManagement:previewDatasetManagement,PreviewManagement:previewManagement,CreatePreviewDataset:createPreviewDatasetInput,CreatePreviewIntent:createPreviewIntentInput,StopPreviewIntent:stopPreviewIntentInput,
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
  const paths:Record<string,Record<string,unknown>> = Object.fromEntries(commandRoutes.map(route => [route.path, { post: {
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
  const errors=Object.fromEntries(['400','401','403','404','409','412','413','415','422','428','429','500','503'].map(code=>[code,{description:'公共错误；未知提交结果先按原操作键查询',content:content('ErrorEnvelope')}]));
  const add=(path:string,method:string,operationId:string,responseSchema?:string,parameters:unknown[]=[],requestSchema?:string,status=method==='post'?'201':'200')=>{
    paths[path]??={};paths[path]![method]={operationId,'x-implementation-status':'implemented-offline',security:[{trustedIdentity:[]}],parameters,
      ...(requestSchema?{requestBody:{required:true,content:content(requestSchema)}}:{}),responses:{[status]:{description:'已提交的输入事实或当前权限下的读取',...(responseSchema?{content:content(responseSchema)}:{})},...errors}};
  };
  const parameter=(name:string,schema:z.ZodType,location='path',required=true)=>({name,in:location,required,schema:jsonSchema(schema)});
  const key=parameter('Idempotency-Key',idempotencyKey,'header');
  const page=[{name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:200,default:50}}];
  for(const [suffix,operationId,mime] of [['view','ReadWorkbenchPage','text/html'],['client.js','ReadWorkbenchClient','application/javascript'],['return-client.js','ReadWorkbenchReturnClient','application/javascript']] as const){
    const path='/api/v1/workbench/'+suffix;add(path,'get',operationId,undefined,suffix==='view'?[parameter('projectId',ids.project,'query',false),parameter('runId',ids.run,'query',false)]:[]);
    (paths[path]!.get as {responses:Record<string,unknown>}).responses['200']={description:'受保护工作台；runId须同时指定projectId，选中上下文按当前成员检查；GET无写入副作用',content:{[mime]:{schema:{type:'string'}}}};
  }
  add('/api/v1/projects','get','ListProjects',undefined,[{name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:100,default:20}},{name:'cursor',in:'query',schema:{type:'string',maxLength:1024}}]);
  add('/api/v1/projects/{projectId}/tasks','post','CreateTask','OperationReceipt',[parameter('projectId',ids.project),key,parameter('If-Match',strongETag,'header')],'CreateTask');
  add('/api/v1/projects/{projectId}/workspace','get','ReadWorkspace','Workspace',[parameter('projectId',ids.project),parameter('runId',ids.run,'query',false),{name:'afterMessageId',in:'query',schema:{type:'string',maxLength:256}},...page]);
  add('/api/v1/projects/{projectId}/runs/{runId}/delivery','get','ReadWorkbenchDelivery','WorkbenchDelivery',[parameter('projectId',ids.project),parameter('runId',ids.run),{name:'afterRevision',in:'query',schema:{type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER,default:0}},parameter('selectedCandidateId',ids.candidate,'query',false),{name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:20,default:20}}]);
  add('/api/v1/runs/{runId}/sources','get','ReadWorkbenchSource','WorkbenchSource',[parameter('runId',ids.run),{name:'ref',in:'query',required:true,description:'严格sourceRef的JSON；消息属于准确Run，材料为已保存依据中的同ID/hash引用，需求按准确版本。最多2 MiB纯文本，无下载或写入副作用。',schema:{type:'string',minLength:1,maxLength:4096}}]);
  add('/api/v1/projects/{projectId}/runs/{runId}/events','get','ReadEvents',undefined,[parameter('projectId',ids.project),parameter('runId',ids.run),{name:'afterSeq',in:'query',schema:{type:'integer',minimum:0,default:0}},...page]);
  add('/api/v1/operations/lookup','get','LookupInputOperation','InputOperation',[{name:'scope',in:'query',required:true,schema:{type:'string',maxLength:128}},parameter('key',idempotencyKey,'query'),{name:'includeAbsence',in:'query',required:false,schema:{type:'boolean',default:false},description:'true时返回准确主体／scope／key和operation（明确不存在为null）；权限失败仍为错误，404不构成不存在证明。'}]);
  (paths['/api/v1/operations/lookup']!.get as {responses:Record<string,unknown>}).responses['200']={description:'默认返回原InputOperation；includeAbsence=true返回受保护的明确查询结果。',content:{'application/json':{schema:{oneOf:[{$ref:'#/components/schemas/InputOperation'},{$ref:'#/components/schemas/InputOperationLookup'}]}}}};
  add('/api/v1/operations/{operationId}','get','ReadInputOperation','InputOperation',[parameter('operationId',ids.operation)]);
  add('/api/v1/attachments','post','UploadAttachment',undefined,[key]);
  (paths['/api/v1/attachments']!.post as Record<string,unknown>).requestBody={required:true,content:{'multipart/form-data':{schema:{type:'object',additionalProperties:false,required:['clientAttachmentId','file'],properties:{clientAttachmentId:{type:'string',format:'uuid'},file:{type:'string',format:'binary',description:'非空 UTF-8 .md/.markdown/.txt；每文件最多 2 MiB，单次只接收一个文件'}}}}}};
  add('/api/v1/attachments/{attachmentId}','get','ReadAttachment','Attachment',[parameter('attachmentId',ids.attachment)]);
  add('/api/v1/attachments/{attachmentId}','delete','RemoveAttachment','Attachment',[parameter('attachmentId',ids.attachment)]);
  add('/api/v1/attachments/{attachmentId}/content','get','ReadAttachmentContent',undefined,[parameter('attachmentId',ids.attachment)]);
  add('/api/v1/runs/{runId}/understanding','get','ReadUnderstanding','Understanding',[parameter('runId',ids.run),parameter('requirementRevision',revision,'query',false)]);
  add('/api/v1/runs/{runId}/understanding:retry','post','RetryUnderstanding','OperationReceipt',[parameter('runId',ids.run),key,parameter('If-Match',strongETag,'header')],'RetryUnderstanding','202');
  add('/api/v1/runs/{runId}/plans','get','ReadPlan','PlanReview',[parameter('runId',ids.run),parameter('revision',revision,'query',false)]);
  const acceptancePath='/api/v1/runs/{runId}/candidates/{candidateId}/acceptance',acceptanceParameters=[parameter('runId',ids.run),parameter('candidateId',ids.candidate)],conditionalAcceptance=[...acceptanceParameters,key,parameter('If-Match',strongETag,'header')];
  add(acceptancePath,'get','ReadAcceptanceBasis','AcceptanceBasis',acceptanceParameters);
  add(acceptancePath+'/preparations','get','ListCandidateAcceptancePreparations','AcceptancePreparationList',[...acceptanceParameters,{name:'afterSequence',in:'query',schema:{type:'integer',minimum:0,default:0}},{name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:100,default:20}}]);
  add(acceptancePath+'/preparations','post','BeginAcceptance','AcceptancePreparation',conditionalAcceptance,'BeginAcceptance','202');
  add(acceptancePath+'/replacement-confirmations','post','ConfirmAcceptanceReplacement','AcceptanceReplacementReceipt',conditionalAcceptance,'ConfirmAcceptanceReplacement');
  const preparationPath=acceptancePath+'/preparations/{operationId}',preparationParameters=[...acceptanceParameters,parameter('operationId',ids.operation)];
  add(preparationPath,'get','ReadAcceptancePreparation','AcceptancePreparation',preparationParameters);
  add(preparationPath+'/close-unsent','post','CloseUnsentAcceptance','AcceptancePreparation',[...preparationParameters,key,parameter('If-Match',strongETag,'header')],'CloseUnsentAcceptance','200');
  add(preparationPath+'/abort','post','AbortAcceptance','AcceptanceAbortReceipt',[...preparationParameters,key,parameter('If-Match',strongETag,'header')],'AbortAcceptance','202');
  add('/api/v1/candidates/{candidateId}:accept','post','AcceptCandidate','AcceptanceCommitReceipt',[parameter('candidateId',ids.candidate),key,parameter('If-Match',strongETag,'header')],'AcceptCandidate','202');
  (paths['/api/v1/candidates/{candidateId}:accept']!.post as Record<string,unknown>).description='准确两阶段T5提交，先实际复核冻结材料字节；成功回执固定ACCEPTED及当时PENDING，当前发布另查。原UUID／正文恢复先于新版本和配置检查。默认新接受关闭。';
  const reviewPath='/api/v1/runs/{runId}/candidates/{candidateId}/review',reviewParameters=[parameter('runId',ids.run),parameter('candidateId',ids.candidate)];
  add(reviewPath,'get','ReadCandidateReview','CandidateReviewEntry',reviewParameters);
  add(reviewPath+'/results','post','RecordCandidateReview','CandidateHumanResult',[...reviewParameters,key,parameter('If-Match',strongETag,'header')],'RecordCandidateReview');
  add(reviewPath+'/rejections','post','RecordCandidateRejection','CandidateRejectionResult',[...reviewParameters,key,parameter('If-Match',strongETag,'header')],'RecordCandidateRejection');
  const reviewHistoryPage=[{name:'afterSequence',in:'query',schema:{type:'integer',minimum:0,default:0}},{name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:100,default:20}}];
  add(reviewPath+'/history','get','ReadCandidateReviewHistory','CandidateReviewHistory',[...reviewParameters,parameter('itemId',opaqueKey,'query',false),...reviewHistoryPage]);
  add(reviewPath+'/rejections/history','get','ReadCandidateRejectionHistory','CandidateRejectionHistory',[...reviewParameters,parameter('rejectionId',opaqueKey,'query',false),...reviewHistoryPage]);
  for(const [suffix,operationId,mime] of [['view','ReadCandidateReviewPage','text/html'],['client.js','ReadCandidateReviewClient','application/javascript']] as const){const path=reviewPath+'/'+suffix;add(path,'get',operationId,undefined,reviewParameters);(paths[path]!.get as {responses:Record<string,unknown>}).responses['200']={description:'当前成员准确候选审查入口；GET无写入副作用',content:{[mime]:{schema:{type:'string'}}}};}
  const releasePath='/api/v1/runs/{runId}/releases/{releaseId}',releaseParameters=[parameter('runId',ids.run),parameter('releaseId',ids.release)];
  add('/api/v1/releases/{releaseId}/exports','post','CreateReleaseExport','ReleaseExport',[parameter('releaseId',ids.release),key],'CreateReleaseExport','202');
  add('/api/v1/releases/{releaseId}/exports','get','ListReleaseExports','ReleaseExportList',[parameter('releaseId',ids.release),parameter('afterExportId',opaqueKey,'query',false),...page]);
  for(const [suffix,operationId,mime,description] of [['view','ReadReleaseExportPage','text/html','当前成员React交付入口；GET不创建或重试'],['client.js','ReadReleaseExportClient','application/javascript','当前成员读取固定本地React资产；不从CDN加载']] as const){
    const path='/api/v1/releases/{releaseId}/exports/'+suffix;add(path,'get',operationId,undefined,[parameter('releaseId',ids.release)]);
    (paths[path]!.get as {responses:Record<string,unknown>}).responses['200']={description,content:{[mime]:{schema:{type:'string'}}}};
  }
  add('/api/v1/exports/{exportId}','get','ReadReleaseExport','ReleaseExport',[parameter('exportId',opaqueKey)]);
  add('/api/v1/exports/{exportId}/retry','post','RetryReleaseExport','ReleaseExport',[parameter('exportId',opaqueKey)],'RetryReleaseExport','202');
  add('/api/v1/exports/{exportId}/download','get','DownloadReleaseExport',undefined,[parameter('exportId',opaqueKey)]);
  const exportDownload=paths['/api/v1/exports/{exportId}/download']!.get as {responses:Record<string,unknown>};
  exportDownload.responses['200']={description:'固定 READY 作业的 ZIP attachment；每次当前成员鉴权；不重新生成或改动验收',content:{'application/zip':{schema:{type:'string',format:'binary'}}}};
  exportDownload.responses['416']={description:'不支持 Range',content:content('ErrorEnvelope')};
  add(releasePath,'get','ReadReleaseEntry','ReleaseEntryView',releaseParameters);
  add(releasePath+'/access','post','IssueReleaseAccess','ReleaseAccessTicket',[...releaseParameters,parameter('Origin',z.url(),'header')],'ReleaseAccessInput','200');
  add(releasePath+'/view','get','ReadReleasePage',undefined,releaseParameters);
  const releasePage=paths[releasePath+'/view']!.get as {responses:Record<string,unknown>};
  releasePage.responses['200']={description:'当前成员访问已接受应用；GET 不签票据',content:{'text/html':{schema:{type:'string'}}}};
  const previewPath='/api/v1/runs/{runId}/previews/{previewId}',previewParameters=[parameter('runId',ids.run),parameter('previewId',ids.preview)];
  add(previewPath,'get','ReadPreviewEntry','PreviewEntryView',previewParameters);
  const previewManagementPath='/api/v1/runs/{runId}/candidates/{candidateId}/preview-management',previewManagementParameters=[parameter('runId',ids.run),parameter('candidateId',ids.candidate)],previewManagementConditional=[...previewManagementParameters,key,parameter('If-Match',strongETag,'header')];
  add(previewManagementPath,'get','ReadCandidatePreviewWorkspace','CandidatePreviewWorkspace',[...previewManagementParameters,...['afterDatasetSequence','afterPreviewSequence'].map(name=>({name,in:'query',schema:{type:'integer',minimum:0,default:0}})),{name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:20,default:10}}]);
  add(previewManagementPath+'/view','get','ReadCandidatePreviewManagementPage',undefined,previewManagementParameters);
  add(previewManagementPath+'/client.js','get','ReadCandidatePreviewManagementClient',undefined,previewManagementParameters);
  for(const [suffix,mime,description]of [['/view','text/html','当前成员预览管理页；GET不准备数据、启动、停止、签票据或接受'],['/client.js','application/javascript','当前成员预览管理React脚本']]){const operation=paths[previewManagementPath+suffix]!.get as {responses:Record<string,unknown>};operation.responses['200']={description,content:{[mime!]:{schema:{type:'string'}}}};}
  add(previewManagementPath+'/datasets','post','CreatePreviewDataset','PreviewDatasetManagement',previewManagementConditional,'CreatePreviewDataset','202');
  add(previewManagementPath+'/datasets/{datasetId}','get','ReadCandidatePreviewDataset','PreviewDatasetManagement',[...previewManagementParameters,parameter('datasetId',ids.dataset)]);
  add(previewManagementPath+'/previews','post','CreatePreviewIntent','PreviewManagement',previewManagementConditional,'CreatePreviewIntent','202');
  add(previewManagementPath+'/previews/{previewId}','get','ReadCandidateManagedPreview','PreviewManagement',[...previewManagementParameters,parameter('previewId',ids.preview)]);
  add(previewManagementPath+'/previews/{previewId}/stop','post','StopPreviewIntent','PreviewManagement',[...previewManagementParameters,parameter('previewId',ids.preview),key],'StopPreviewIntent','202');
  add(previewPath+'/access','post','IssuePreviewAccess','PreviewAccessTicket',[...previewParameters,parameter('Origin',z.url(),'header')],'PreviewAccessInput','200');
  add(previewPath+'/view','get','ReadPreviewPage',undefined,previewParameters);
  const previewPage=paths[previewPath+'/view']!.get as {responses:Record<string,unknown>};
  previewPage.responses['200']={description:'当前成员只读预览页；受限 iframe，GET 不签票据、不接受版本',content:{'text/html':{schema:{type:'string'}}}};
  const downloadPath='/api/v1/runs/{runId}/candidates/{candidateId}/materials/{materialKey}/download';
  add(downloadPath,'get','DownloadFrozenMaterial',undefined,[parameter('runId',ids.run),parameter('candidateId',ids.candidate),parameter('materialKey',opaqueKey)]);
  const download=paths[downloadPath]!.get as {responses:Record<string,unknown>};
  download.responses['200']={description:'原冻结材料的 inert attachment；权限和实际内容复核；不接受或重新生成',headers:{'Content-Disposition':{schema:{type:'string'},description:'attachment'},'X-Content-Type-Options':{schema:{type:'string',const:'nosniff'}}},content:{'application/octet-stream':{schema:{type:'string',format:'binary'}}}};
  download.responses['416']={description:'此材料入口不支持 Range；原下载授权及内容保持不变',content:content('ErrorEnvelope')};
  for(const path of ['/api/v1/projects','/api/v1/runs/{runId}/messages','/api/v1/runs/{runId}/questions:answer']){
    const post=paths[path]!.post as Record<string,unknown>;post['x-implementation-status']='implemented-offline';post.security=[{trustedIdentity:[]}];post.description='已实现持久输入与当前成员授权；默认无身份接入点时拒绝请求。保存成功不表示真实模型处理完成。';
  }
  const confirm=paths['/api/v1/runs/{runId}/plans/{revision}:confirm']!.post as Record<string,unknown>;
  confirm['x-implementation-status']='implemented-offline';confirm.security=[{trustedIdentity:[]}];
  confirm.description='按当前成员、原操作键、版本、审阅哈希和计划校验记录明确确认；后台执行另行准入。';
  for(const [path,item] of Object.entries(paths))if(path.startsWith('/api/v1/'))for(const operation of Object.values(item)){
    const op=operation as {parameters:unknown[]};op.parameters.push({...parameter('X-DevMesh-Principal',opaqueKey,'header',false),description:'可选页面主体绑定；须与可信身份解析结果相同，不同则403且不执行副作用；不可用此头建立身份，重复头400。'});
  }
  return {
    openapi: '3.1.0', jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: { title: 'DevMesh 核心契约', version: '0.3.0', description: '共享命令、输入与需求理解 API。逐路由标记实现范围；离线代码与测试不代表企业身份、模型或产品全链路验收。其余 D3 API 随工作包增量补齐。' },
    'x-runtime-constraints': ['permit 有效期顺序、宿主当前代际及资源范围', '测试成果所有报告绑定相同 SHA', '事件 envelope 与 payload 版本和归属一致', 'ETag 安全整数范围', 'DAG 无环、来源存在、ACL、幂等及事务由后续服务负责'],
    paths,
    components: {
      securitySchemes: { trustedIdentity:{type:'http',scheme:'bearer',description:'可信 IdentityResolver 接入点；默认未配置，不签发测试 token、匿名用户或企业登录。CLI 当前没有企业 resolver。'},browserSession: { type: 'apiKey', in: 'cookie', name: 'devmesh_session', description: '后续企业浏览器 Session；当前 Cookie 认证未接入，必须另行完成 Origin/CSRF。' } },
      schemas: Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, jsonSchema(schema, name)])),
    },
  };
}
