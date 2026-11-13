import {z} from 'zod';
import {ids,opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import type {ReleaseAccessBinding,ReleaseAccessTarget} from './release-access-protocol.js';
import {previewOrigin as releaseOrigin} from './preview-session-protocol.js';
const gateway={principalId:opaqueKey,gatewayId:opaqueKey,configurationHash:sha256};
const origins={platformOrigin:releaseOrigin,releaseOrigin};
export const releaseSessionRequests={
 issueReleaseTicket:z.strictObject({...gateway,...origins,subjectPrincipalId:opaqueKey,runId:ids.run,releaseId:ids.release,ticketId:opaqueKey,tokenSha256:sha256,expiresAt:timestamp}),
 exchangeReleaseTicket:z.strictObject({...gateway,...origins,ticketTokenSha256:sha256,sessionId:opaqueKey,sessionTokenSha256:sha256,expiresAt:timestamp}),
 authenticateReleaseSession:z.strictObject({...gateway,releaseOrigin,tokenSha256:sha256}),
 revokeReleaseSession:z.strictObject({...gateway,releaseOrigin,tokenSha256:sha256}),
};
export interface ReleaseTicket {
 ticketId:string;projectId:string;gatewayId:string;subjectPrincipalId:string;target:ReleaseAccessTarget;
 platformOrigin:string;releaseOrigin:string;createdAt:string;expiresAt:string;state:'ISSUED'|'CONSUMED';sessionId:string|null;
}
export interface ReleaseSession {
 sessionId:string;ticketId:string;projectId:string;gatewayId:string;subjectPrincipalId:string;target:ReleaseAccessTarget;
 platformOrigin:string;releaseOrigin:string;createdAt:string;expiresAt:string;state:'ACTIVE'|'REVOKED';revokedAt:string|null;
}
export type ReleaseSessionMethod=keyof typeof releaseSessionRequests;
export type ReleaseSessionInput<M extends ReleaseSessionMethod>=z.output<(typeof releaseSessionRequests)[M]>;
export interface ReleaseSessionResults {
 issueReleaseTicket:ReleaseTicket;
 exchangeReleaseTicket:ReleaseSession;
 authenticateReleaseSession:{session:ReleaseSession;binding:ReleaseAccessBinding};
 revokeReleaseSession:ReleaseSession;
}
