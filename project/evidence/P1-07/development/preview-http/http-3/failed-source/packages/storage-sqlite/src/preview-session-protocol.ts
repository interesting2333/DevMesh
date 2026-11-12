import {z} from 'zod';
import {ids,opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import type {PreviewAccessBinding,PreviewAccessTarget} from './preview-access-protocol.js';
export const previewOrigin=z.string().max(2048).refine(value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&u.origin===value&&!u.username&&!u.password&&!u.hostname.endsWith('.');}catch{return false;}});
const gateway={principalId:opaqueKey,gatewayId:opaqueKey,configurationHash:sha256};
const origins={platformOrigin:previewOrigin,previewOrigin};
export const previewSessionRequests={
 issuePreviewTicket:z.strictObject({...gateway,...origins,subjectPrincipalId:opaqueKey,runId:ids.run,previewId:ids.preview,ticketId:opaqueKey,tokenSha256:sha256,expiresAt:timestamp}),
 exchangePreviewTicket:z.strictObject({...gateway,...origins,ticketTokenSha256:sha256,sessionId:opaqueKey,sessionTokenSha256:sha256,expiresAt:timestamp}),
 authenticatePreviewSession:z.strictObject({...gateway,previewOrigin,tokenSha256:sha256}),
 revokePreviewSession:z.strictObject({...gateway,previewOrigin,tokenSha256:sha256}),
};
export interface PreviewTicket {
 ticketId:string;projectId:string;gatewayId:string;subjectPrincipalId:string;target:PreviewAccessTarget;
 platformOrigin:string;previewOrigin:string;createdAt:string;expiresAt:string;state:'ISSUED'|'CONSUMED';sessionId:string|null;
}
export interface PreviewSession {
 sessionId:string;ticketId:string;projectId:string;gatewayId:string;subjectPrincipalId:string;target:PreviewAccessTarget;
 platformOrigin:string;previewOrigin:string;createdAt:string;expiresAt:string;state:'ACTIVE'|'REVOKED';revokedAt:string|null;
}
export type PreviewSessionMethod=keyof typeof previewSessionRequests;
export type PreviewSessionInput<M extends PreviewSessionMethod>=z.output<(typeof previewSessionRequests)[M]>;
export interface PreviewSessionResults {
 issuePreviewTicket:PreviewTicket;
 exchangePreviewTicket:PreviewSession;
 authenticatePreviewSession:{session:PreviewSession;binding:PreviewAccessBinding};
 revokePreviewSession:PreviewSession;
}
