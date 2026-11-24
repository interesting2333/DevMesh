import {assistantArtifact,assistantPath,sha256} from '@devmesh/contracts';
import type {AssistantBackend} from '@devmesh/contracts';
import type {SqliteStorage} from '@devmesh/storage-sqlite';
import {StorageError} from '@devmesh/storage-sqlite';
export const generatedPreviewPolicy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts";
export async function readAssistantArtifact(storage:SqliteStorage,backend:AssistantBackend|undefined,principalId:string,conversationId:string,sessionId:string,path:string,hash:string){
 if(!backend?.artifact)throw new StorageError('ASSISTANT_TOOLS_UNAVAILABLE',503,'Artifact backend unavailable');assistantPath.parse(path);sha256.parse(hash);
 const session=await storage.request('readAssistantSession',{principalId,conversationId,sessionId});if(!session.workspace||!['READY','BLOCKED','SUPERSEDED'].includes(session.state))throw new StorageError('ASSISTANT_RESULT_UNAVAILABLE',409,'Artifact is not ready');
 const files=Array.isArray(session.result.files)?session.result.files.map(f=>assistantArtifact.parse(f)):[];if(session.result.workspaceKind!=='GENERATED'||!files.some(f=>f.path===path&&f.sha256===hash))throw new StorageError('RESOURCE_NOT_FOUND',404,'Artifact not published');
 return backend.artifact(session.workspace,path,hash);
}
