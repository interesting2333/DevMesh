import { z } from "zod";
import { executionPermit, ids, opaqueKey, relativeFile, sha256, timestamp } from "@devmesh/contracts";
//#region src/workspace-fence.ts
const workspaceBindingSchema = z.strictObject({
	attemptId: opaqueKey,
	ownerKind: z.enum(["workflowAttempt", "invocationAttempt"]),
	resourceId: opaqueKey,
	relativePath: relativeFile,
	sourceDirectory: z.literal("repo").optional()
});
const acquireWorkspaceFence = z.strictObject({
	operationId: ids.operation,
	parentOperationId: ids.operation,
	workspaceRef: opaqueKey,
	permit: executionPermit,
	holderToken: z.uuid(),
	purpose: z.enum(["write", "cleanup"]).optional()
});
const releaseWorkspaceFence = z.strictObject({
	holderToken: z.uuid(),
	requestHash: sha256
});
const workspaceFenceSchema = z.strictObject({
	fenceId: opaqueKey,
	controllerId: opaqueKey,
	operationId: ids.operation,
	workspaceRef: opaqueKey,
	workspacePath: z.string().min(1),
	holderToken: z.uuid(),
	requestHash: sha256,
	request: acquireWorkspaceFence,
	state: z.enum(["ACTIVE", "RELEASED"]),
	createdAt: timestamp,
	releasedAt: timestamp.nullable()
});
//#endregion
export { workspaceFenceSchema as i, releaseWorkspaceFence as n, workspaceBindingSchema as r, acquireWorkspaceFence as t };

//# sourceMappingURL=workspace-fence-BX3LCM3x.mjs.map