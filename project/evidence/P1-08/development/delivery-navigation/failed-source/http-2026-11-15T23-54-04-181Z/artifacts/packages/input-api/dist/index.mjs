import express from "express";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { ContractError, abortAcceptanceInput, acceptCandidateInput, acceptanceAbortReceipt, acceptanceBasisView, acceptanceCommitReceipt, acceptancePreparationList, acceptancePreparationView, acceptanceReplacementReceipt, answerQuestionsInput, attachmentName, beginAcceptanceInput, candidateHumanResult, candidatePreviewWorkspace, candidateRejectionHistory, candidateRejectionResult, candidateReviewEntry, candidateReviewHistory, closeUnsentAcceptanceInput, commandBodies, confirmAcceptanceReplacementInput, createPreviewDatasetInput, createPreviewIntentInput, createProjectInput, createReleaseExportInput, createTaskInput, errorCode, gitCommit, idempotencyKey, ids, opaqueKey, parseContract, previewAccessTicket, previewDatasetManagement, previewEntryView, previewManagement, recordCandidateRejectionInput, recordCandidateReviewInput, releaseAccessTicket, releaseEntryView, releaseExportEntryView, releaseExportListView, releaseExportView, retryReleaseExportInput, retryUnderstandingInput, saveMessageInput, sha256, sourceRef, stopPreviewIntentInput, uploadMetadata, workbenchCandidateSummary, workbenchDeliveryView, workbenchSourceView } from "@devmesh/contracts";
import { StorageError, canonical } from "@devmesh/storage-sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Busboy from "busboy";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { Transform } from "node:stream";
import { safePath } from "@devmesh/blob-store";
//#region src/workbench-return.ts
const workbenchReturnStyle = ".workbench-return{max-width:1050px;margin:0 auto;padding:18px 24px 0;font-family:system-ui,sans-serif}.workbench-return a{color:#205a4d;display:inline-flex;min-height:44px;align-items:center;text-underline-offset:3px}.workbench-return a:focus-visible{outline:3px solid #d99127;outline-offset:3px}@media(max-width:600px){.workbench-return{padding:12px 16px 0}}";
/** Derive the return target from this authenticated Run, never a return URL. */
async function getWorkbenchReturnContext(content, principalId, runId) {
	const exactRun = parseContract(ids.run, runId), access = await content.storage.request("checkInputAccess", {
		principalId,
		runId: exactRun
	}), projectId = parseContract(ids.project, access.projectId);
	return {
		principalId: parseContract(opaqueKey, principalId),
		projectId,
		targetRunId: exactRun
	};
}
function workbenchReturnNav(context, nonce) {
	const { projectId, targetRunId: exactRun } = context;
	const href = "/api/v1/workbench/view?projectId=" + encodeURIComponent(projectId) + "&amp;runId=" + encodeURIComponent(exactRun);
	const boot = JSON.stringify(context).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
	return "<nav class=\"workbench-return\" aria-label=\"工作台返回导航\"><a id=\"workbench-return\" href=\"" + href + "\">返回工作台</a></nav><script id=\"workbench-return-data\" type=\"application/json\" nonce=\"" + nonce + "\">" + boot + "<\/script><script defer nonce=\"" + nonce + "\" src=\"/api/v1/workbench/return-client.js\"><\/script>";
}
//#endregion
//#region src/export-page.ts
const empty$6 = z.strictObject({});
const styles = `
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d302f;background:#f4f3ef;font-synthesis:none}*{box-sizing:border-box}body{margin:0}main{max-width:1000px;margin:auto;padding:36px 24px 64px}a{color:#155b4d;text-underline-offset:3px}button,.download{font:inherit;min-height:44px;border-radius:10px;padding:10px 16px;cursor:pointer;border:1px solid #b5c9c2;background:#fff;color:#204a40}button:disabled{cursor:default;opacity:.5}button:focus-visible,a:focus-visible{outline:3px solid #d99127;outline-offset:3px}.primary,.download{background:#205a4d;color:#fff;border-color:#205a4d}.download{display:inline-flex;align-items:center;text-decoration:none}.topline{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:36px}.brand{font-weight:750;letter-spacing:.06em}.eyebrow{font-size:13px;letter-spacing:.1em;color:#496a5e}h1{font-size:clamp(30px,5vw,42px);letter-spacing:-.04em;margin:12px 0 14px}h2{font-size:20px;margin:0}p{line-height:1.7}.muted{color:#536b64;font-size:14px}.version{background:#e8eee6;border:1px solid #cfdbcd;border-radius:16px;padding:20px 24px;margin:24px 0}.version-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.commit{font-family:ui-monospace,Consolas,monospace;overflow-wrap:anywhere}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:28px 0 18px}.actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.notice{padding:14px 18px;border-radius:12px;background:#fff6dc;border:1px solid #e7d398;line-height:1.7}.error{background:#fff0ea;border-color:#edbdad}.jobs{display:grid;gap:14px}.job{border:1px solid #d7dfd9;border-radius:16px;background:#fff;padding:22px}.job-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.job h3{font-size:16px;margin:0}.badge{font-size:13px;font-weight:650;border-radius:100px;padding:5px 11px;background:#edf1f0;color:#36544b}.badge.READY{background:#e4f1e6;color:#235334}.badge.FAILED{background:#ffece7;color:#8d3a24}.badge.PACKING{background:#e6eff8;color:#295776}.job-details{display:grid;gap:8px;grid-template-columns:repeat(2,minmax(0,1fr));margin:16px 0;font-size:14px}.job-details div{display:grid;gap:4px}.job-details dt{color:#67786e}.job-details dd{margin:0;overflow-wrap:anywhere}.job details{margin-top:14px;color:#546c64;font-size:13px}.job summary{cursor:pointer;padding:4px 0}.empty{border:1px dashed #bdcdc2;border-radius:16px;padding:36px 24px;text-align:center;background:#fafbf8}.pager{display:flex;justify-content:space-between;align-items:center;margin:22px 0}.footer{margin-top:28px;color:#63746b;font-size:13px}.section-label{margin:20px 0 10px;color:#536d62;font-size:13px}@media(max-width:600px){main{padding:24px 16px 40px}.topline{margin-bottom:26px}.version{padding:18px}.job{padding:18px}.job-details{grid-template-columns:1fr}.toolbar .actions{width:100%}.primary{flex:1}}
`;
function mountExportPages(router, content, route) {
	const entry = async (request, identity) => {
		empty$6.parse(request.query);
		const releaseId = parseContract(opaqueKey, request.params.releaseId);
		return parseContract(releaseExportEntryView, await content.storage.request("getReleaseExportEntry", {
			principalId: identity.principalId,
			releaseId
		}));
	};
	router.get("/releases/:releaseId/exports/view", route(async (request, response, identity) => {
		const release = await entry(request, identity), list = parseContract(releaseExportListView, await content.storage.request("listReleaseExports", {
			principalId: identity.principalId,
			releaseId: release.releaseId,
			limit: 20
		})), returnContext = await getWorkbenchReturnContext(content, identity.principalId, release.runId), nonce = randomBytes(18).toString("base64url");
		const json = JSON.stringify({
			entry: release,
			list
		}).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`);
		response.type("text/html; charset=utf-8").send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>交付包 · DevMesh</title><style nonce="${nonce}">${styles}${workbenchReturnStyle}</style></head><body>${workbenchReturnNav(returnContext, nonce)}<div id="root"><main><h1>交付包</h1><p role="status">正在加载交付记录…</p><noscript>请启用 JavaScript 查看和创建交付包。</noscript></main></div><script id="export-data" type="application/json" nonce="${nonce}">${json}<\/script><script defer nonce="${nonce}" src="/api/v1/releases/${encodeURIComponent(release.releaseId)}/exports/client.js"><\/script></body></html>`);
	}));
	router.get("/releases/:releaseId/exports/client.js", route(async (request, response, identity) => {
		await entry(request, identity);
		const bytes = await readFile(new URL("./web/export/export-client.js", import.meta.url));
		await entry(request, identity);
		response.type("application/javascript; charset=utf-8").send(bytes);
	}));
}
//#endregion
//#region src/export.ts
const empty$5 = z.strictObject({});
const fail$6 = (code, status) => {
	throw new StorageError(code, status, "Export requires current membership and its original frozen job");
};
function mountExportRoutes(router, content, route) {
	mountExportPages(router, content, route);
	const subject = (request, identity) => ({
		principalId: identity.principalId,
		exportId: parseContract(opaqueKey, request.params.exportId)
	});
	const guarded = (handler) => route(async (request, response, identity) => {
		try {
			empty$5.parse(request.query);
			await handler(request, response, identity);
		} catch (error) {
			const { code, status } = error;
			if (code?.startsWith("EXPORT_")) fail$6(code === "EXPORT_LIMIT_EXCEEDED" ? "LIMIT_EXCEEDED" : "EXPORT_UNAVAILABLE", status === 413 ? 413 : 409);
			throw error;
		}
	});
	const body = (request) => {
		if (!request.is("application/json")) fail$6("CONTENT_TYPE_INVALID", 415);
		return request.body;
	};
	router.post("/releases/:releaseId/exports", guarded(async (request, response, identity) => {
		const releaseId = parseContract(opaqueKey, request.params.releaseId), value = parseContract(createReleaseExportInput, body(request));
		const job = await content.storage.request("createReleaseExport", {
			meta: {
				principalId: identity.principalId,
				scopeId: releaseId,
				idempotencyKey: parseContract(idempotencyKey, request.headers["idempotency-key"])
			},
			releaseId,
			...value
		});
		response.status(202).json(parseContract(releaseExportView, job));
	}));
	router.get("/releases/:releaseId/exports", route(async (request, response, identity) => {
		const query = parseContract(z.strictObject({
			afterExportId: opaqueKey.optional(),
			limit: z.string().regex(/^[1-9][0-9]{0,2}$/).transform(Number).pipe(z.number().max(200)).optional()
		}), request.query), releaseId = parseContract(opaqueKey, request.params.releaseId);
		response.json(parseContract(releaseExportListView, await content.storage.request("listReleaseExports", {
			principalId: identity.principalId,
			releaseId,
			...query
		})));
	}));
	router.get("/exports/:exportId", guarded(async (request, response, identity) => {
		response.json(parseContract(releaseExportView, await content.storage.request("getReleaseExport", subject(request, identity))));
	}));
	router.post("/exports/:exportId/retry", guarded(async (request, response, identity) => {
		const value = parseContract(retryReleaseExportInput, body(request));
		response.status(202).json(parseContract(releaseExportView, await content.storage.request("retryReleaseExport", {
			...subject(request, identity),
			...value
		})));
	}));
	router.get("/exports/:exportId/download", guarded(async (request, response, identity) => {
		if (request.headers.range !== void 0) fail$6("RANGE_NOT_SUPPORTED", 416);
		const who = subject(request, identity), job = await content.storage.request("getReleaseExport", who);
		if (job.state !== "READY") fail$6("EXPORT_NOT_READY", 409);
		const opened = await content.openRead(identity.principalId, {
			kind: "releaseExport",
			exportId: who.exportId
		});
		try {
			if (opened.content.contentHash !== job.archiveHash || opened.content.byteSize !== job.archiveSize) fail$6("CONTENT_UNAVAILABLE", 503);
			await content.storage.request("getReleaseExport", who);
			response.setHeader("Content-Type", "application/zip");
			response.setHeader("Content-Length", job.archiveSize);
			response.setHeader("Content-Disposition", `attachment; filename="${who.exportId}.zip"`);
			response.setHeader("Accept-Ranges", "none");
			response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox; frame-ancestors 'none'");
			response.setHeader("Referrer-Policy", "no-referrer");
			await pipeline(opened.stream, response);
		} finally {
			opened.stream.destroy();
			await opened.release();
		}
	}));
}
//#endregion
//#region src/review.ts
const empty$4 = z.strictObject({});
const positive$1 = z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().safe());
const historyQuery = {
	afterSequence: z.string().regex(/^(0|[1-9][0-9]*)$/).transform(Number).pipe(z.number().int().safe()).optional(),
	limit: positive$1.pipe(z.number().max(100)).optional()
};
const css$3 = `:root{font-family:system-ui,sans-serif;color:#203b36;background:#f4f3ef}*{box-sizing:border-box}body{margin:0}main{max-width:1050px;margin:auto;padding:32px 24px 60px}h1{font-size:36px;margin:22px 0 10px}h2{font-size:21px}h3{font-size:17px}p{line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}a{color:#205a4d}button,input,textarea,select{font:inherit}button{min-height:44px;padding:10px 16px;border-radius:10px;background:#fff;color:#205a4d;border:1px solid #b4c7bd;cursor:pointer}button:disabled{opacity:.5;cursor:default}.primary{background:#205a4d;color:#fff}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #d99127;outline-offset:2px}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.muted{color:#536b64;font-size:14px}.card,.version{padding:22px;border:1px solid #d2ded7;border-radius:16px;background:#fff;margin:16px 0}.version{background:#e8eee6}.commit{font-family:ui-monospace,Consolas,monospace;overflow-wrap:anywhere}.notice{padding:14px 18px;background:#fff2d6;border:1px solid #e1cb8d;border-radius:12px}.badge{font-size:13px;padding:5px 10px;background:#edf1ef;border-radius:30px}.PASS{background:#e3f1e6}.FAIL,.STALE{background:#ffe9e4}label{display:block;margin:14px 0 6px;font-size:14px}textarea,input,select{display:block;max-width:100%;width:100%;border:1px solid #b6c8bc;border-radius:8px;padding:10px;background:#fff;color:#203b36}textarea{resize:vertical;min-height:90px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.pager{display:flex;gap:16px;align-items:center;margin:18px 0}summary{cursor:pointer;padding:8px 0}details{font-size:14px}.history{border-left:3px solid #ccdcd0;padding:0 16px;margin:16px 0}.expected{background:#f3f6f1;padding:12px 16px;border-radius:10px}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:600px){main{padding:24px 16px}h1{font-size:30px}.card,.version{padding:18px}.field-grid{grid-template-columns:1fr}}`;
function mountReviewRoutes(router, content, route) {
	const base = "/runs/:runId/candidates/:candidateId/review";
	const subject = (request, identity) => ({
		principalId: identity.principalId,
		runId: parseContract(ids.run, request.params.runId),
		candidateId: parseContract(ids.candidate, request.params.candidateId)
	});
	const guarded = (handler) => route(async (request, response, identity) => {
		try {
			await handler(request, response, identity);
		} catch (error) {
			const { code, status } = error;
			if (error instanceof StorageError && error.status === 404) throw new StorageError("RESOURCE_NOT_FOUND", 404, "Candidate is not visible");
			if (code?.startsWith("CANDIDATE_") || code?.startsWith("RELEASE_CANDIDATE_")) throw new StorageError(code === "CANDIDATE_REVIEW_LIMIT" ? "LIMIT_EXCEEDED" : "REVIEW_UNAVAILABLE", code === "CANDIDATE_REVIEW_LIMIT" ? 413 : status === 404 ? 404 : status === 422 ? 422 : 409, "Exact candidate review unavailable");
			throw error;
		}
	});
	async function entry(request, identity) {
		empty$4.parse(request.query);
		const who = subject(request, identity), candidate = await content.storage.request("getReleaseCandidate", who), review = await content.storage.request("getCandidateReview", who);
		return parseContract(candidateReviewEntry, {
			runId: who.runId,
			codeCommit: candidate.manifest.codeCommit,
			review
		});
	}
	router.get(base, guarded(async (request, response, identity) => {
		const value = await entry(request, identity);
		response.setHeader("ETag", `"r${value.review.resourceRevision}"`);
		response.json(value);
	}));
	router.get("/runs/:runId/candidates/:candidateId/review/view", guarded(async (request, response, identity) => {
		const value = await entry(request, identity), returnContext = await getWorkbenchReturnContext(content, identity.principalId, value.runId), nonce = randomBytes(18).toString("base64url"), json = JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`);
		response.type("text/html; charset=utf-8").send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>候选审查 · DevMesh</title><style nonce="${nonce}">${css$3}${workbenchReturnStyle}</style></head><body>${workbenchReturnNav(returnContext, nonce)}<div id="root"><main><h1>候选审查</h1><p>正在加载审查项…</p><noscript>请启用JavaScript查看与记录审查。</noscript></main></div><script id="review-data" type="application/json" nonce="${nonce}">${json}<\/script><script defer nonce="${nonce}" src="/api/v1/runs/${encodeURIComponent(value.runId)}/candidates/${encodeURIComponent(value.review.candidateId)}/review/client.js"><\/script></body></html>`);
	}));
	router.get("/runs/:runId/candidates/:candidateId/review/client.js", guarded(async (request, response, identity) => {
		await entry(request, identity);
		const bytes = await readFile(new URL("./web/review/review-client.js", import.meta.url));
		await entry(request, identity);
		response.type("application/javascript; charset=utf-8").send(bytes);
	}));
	const write = (request, identity) => {
		empty$4.parse(request.query);
		if (!request.is("application/json")) throw new StorageError("CONTENT_TYPE_INVALID", 415, "Expected JSON");
		const who = subject(request, identity), match = request.headers["if-match"];
		return {
			meta: {
				principalId: identity.principalId,
				scopeId: who.runId,
				idempotencyKey: parseContract(idempotencyKey, request.headers["idempotency-key"])
			},
			runId: who.runId,
			candidateId: who.candidateId,
			...match === void 0 ? {} : { ifMatch: parseContract(z.string().max(128), match) }
		};
	};
	router.post("/runs/:runId/candidates/:candidateId/review/results", guarded(async (request, response, identity) => {
		const value = write(request, identity), body = parseContract(recordCandidateReviewInput, request.body);
		response.status(201).json(parseContract(candidateHumanResult, await content.storage.request("recordCandidateReview", {
			...value,
			...body
		})));
	}));
	router.post("/runs/:runId/candidates/:candidateId/review/rejections", guarded(async (request, response, identity) => {
		const value = write(request, identity), body = parseContract(recordCandidateRejectionInput, request.body);
		response.status(201).json(parseContract(candidateRejectionResult, await content.storage.request("recordCandidateRejection", {
			...value,
			...body
		})));
	}));
	router.get("/runs/:runId/candidates/:candidateId/review/history", guarded(async (request, response, identity) => {
		const query = parseContract(z.strictObject({
			...historyQuery,
			itemId: opaqueKey.optional()
		}), request.query);
		response.json(parseContract(candidateReviewHistory, await content.storage.request("listCandidateReviewHistory", {
			...subject(request, identity),
			...query
		})));
	}));
	router.get("/runs/:runId/candidates/:candidateId/review/rejections/history", guarded(async (request, response, identity) => {
		const query = parseContract(z.strictObject({
			...historyQuery,
			rejectionId: opaqueKey.optional()
		}), request.query);
		response.json(parseContract(candidateRejectionHistory, await content.storage.request("listCandidateRejectionHistory", {
			...subject(request, identity),
			...query
		})));
	}));
}
//#endregion
//#region src/acceptance-page.ts
const css$2 = `:root{font-family:system-ui,sans-serif;color:#203b36;background:#f4f3ef}*{box-sizing:border-box}body{margin:0}main{max-width:1050px;margin:auto;padding:32px 24px 60px}h1{font-size:36px;margin:22px 0 10px}h2{font-size:21px}p{line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}a{color:#205a4d}button,input,textarea{font:inherit}button{min-height:44px;padding:10px 16px;border-radius:10px;background:#fff;color:#205a4d;border:1px solid #b4c7bd;cursor:pointer}button:disabled{opacity:.5;cursor:default}.primary{background:#205a4d;color:#fff}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #d99127;outline-offset:2px}.row,.actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.row{justify-content:space-between}.actions{margin:16px 0}.muted{color:#536b64;font-size:14px}.card,.version{padding:22px;border:1px solid #d2ded7;border-radius:16px;background:#fff;margin:16px 0}.version{background:#e8eee6}.hash{font-family:ui-monospace,Consolas,monospace;overflow-wrap:anywhere;font-size:13px}.notice{padding:14px 18px;background:#fff2d6;border:1px solid #e1cb8d;border-radius:12px}.badge{font-size:13px;padding:5px 10px;background:#edf1ef;border-radius:30px}label{display:block;margin:14px 0;line-height:1.7}input[type=checkbox]{margin:0 10px 0 0;width:18px;height:18px;vertical-align:middle}textarea{display:block;width:100%;border:1px solid #b6c8bc;border-radius:8px;padding:10px;background:#fff;color:#203b36;resize:vertical;min-height:90px}summary{cursor:pointer;padding:8px 0}dl{display:grid;grid-template-columns:135px minmax(0,1fr);gap:10px 18px}dt{color:#536b64}dd{margin:0;overflow-wrap:anywhere}.history{border-top:1px solid #d2ded7;padding:14px 0}.selected{border-left:3px solid #205a4d;padding-left:16px}@media(max-width:600px){main{padding:24px 16px}h1{font-size:30px}.card,.version{padding:18px}dl{grid-template-columns:1fr;gap:6px}dd{margin-bottom:10px}}`;
function acceptancePage(value, returnContext) {
	const nonce = randomBytes(18).toString("base64url");
	const json = JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
	return {
		policy: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`,
		html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>版本接受 · DevMesh</title><style nonce="${nonce}">${css$2}${workbenchReturnStyle}</style></head><body>${workbenchReturnNav(returnContext, nonce)}<div id="root"><main><h1>版本接受</h1><p>正在加载固定接受依据…</p><noscript>请启用JavaScript查看与确认接受。</noscript></main></div><script id="acceptance-data" type="application/json" nonce="${nonce}">${json}<\/script><script defer nonce="${nonce}" src="/api/v1/runs/${encodeURIComponent(value.runId)}/candidates/${encodeURIComponent(value.candidateId)}/acceptance/client.js"><\/script></body></html>`
	};
}
//#endregion
//#region src/acceptance.ts
const empty$3 = z.strictObject({});
const page$1 = z.strictObject({
	afterSequence: z.string().regex(/^(0|[1-9][0-9]*)$/).transform(Number).pipe(z.number().int().nonnegative().safe()).optional(),
	limit: z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional()
});
function fail$5(code, status) {
	throw new StorageError(code, status, "Exact acceptance entry unavailable");
}
function mountAcceptanceRoutes(router, content, access, route) {
	const policies = new Map(Object.entries(access?.policies ?? {}).map(([projectId, policyHash]) => [ids.project.parse(projectId), sha256.parse(policyHash)]));
	if (access && typeof access.commit !== "function") throw new Error("Trusted acceptance committer is required");
	const commit = access?.commit.bind(access), storage = content.storage, base = "/runs/:runId/candidates/:candidateId/acceptance";
	const guarded = (handler) => route(async (request, response, identity) => {
		try {
			await handler(request, response, identity);
		} catch (error) {
			if (error instanceof StorageError) {
				if (error.status === 404) fail$5("RESOURCE_NOT_FOUND", 404);
				if (error.code.startsWith("ACCEPTANCE_") || error.code.startsWith("ACCEPTED_RELEASE_") || error.code.startsWith("CANDIDATE_") || error.code.startsWith("RELEASE_CANDIDATE_")) fail$5("ACCEPTANCE_UNAVAILABLE", error.status === 503 ? 503 : error.status === 422 ? 422 : 409);
			}
			throw error;
		}
	});
	const subject = (request, identity) => ({
		principalId: identity.principalId,
		runId: parseContract(ids.run, request.params.runId),
		candidateId: parseContract(ids.candidate, request.params.candidateId)
	});
	async function basis(who) {
		const candidate = await storage.request("getReleaseCandidate", who), policyHash = policies.get(candidate.projectId);
		return parseContract(acceptanceBasisView, await storage.request("getCandidateAcceptanceBasis", {
			...who,
			...policyHash ? { policyHash } : {}
		}));
	}
	async function original(who, operationId) {
		await storage.request("getReleaseCandidate", who);
		const p = await storage.request("getAcceptancePreparation", {
			principalId: who.principalId,
			operationId
		});
		if (p.runId !== who.runId || p.candidateId !== who.candidateId) fail$5("RESOURCE_NOT_FOUND", 404);
		return p;
	}
	async function project(who, p) {
		const ready = await storage.request("getAcceptanceReadiness", {
			principalId: who.principalId,
			operationId: p.operationId,
			requestHash: p.requestHash
		}), b = await basis(who);
		const stable = await original(who, p.operationId), same = stable.revision === p.revision && stable.resolution === p.resolution && stable.qualification === p.qualification;
		const policyCurrent = b.configured && b.policyHash === p.policyHash, unresolved = stable.resolution === "UNRESOLVED";
		return parseContract(acceptancePreparationView, {
			operationId: p.operationId,
			runId: p.runId,
			candidateId: p.candidateId,
			releaseId: p.releaseId,
			requestHash: p.requestHash,
			revision: p.revision,
			state: p.state,
			resolution: stable.resolution,
			qualification: stable.qualification,
			basis: Object.fromEntries([
				"candidateRevision",
				"manifestHash",
				"reviewHash",
				"expectedAcceptedReleaseId",
				"dataPlanHash"
			].map((k) => [k, p.request[k]])),
			createdAt: p.createdAt,
			updatedAt: p.updatedAt,
			acceptanceOperationId: stable.acceptanceOperationId,
			readiness: {
				state: ready.state,
				sequence: ready.sequence,
				proofHash: ready.proofHash,
				checkedAt: ready.observation?.checkedAt ?? null
			},
			resourceRevision: b.resourceRevision,
			canCommit: Boolean(same && unresolved && b.canManage && policyCurrent && commit && stable.qualification === "CURRENT" && ready.state === "READY" && ready.proof?.service.claim.schemaVersion === "devmesh.acceptance-service-claim.v1"),
			canCloseUnsent: same && unresolved && b.canManage && p.state === "PREPARED",
			canAbort: same && unresolved && b.canManage && ["SENT", "UNKNOWN"].includes(p.state) && b.currentAcceptedReleaseId === p.request.expectedAcceptedReleaseId
		});
	}
	function write(request, who) {
		empty$3.parse(request.query);
		if (!request.is("application/json")) fail$5("CONTENT_TYPE_INVALID", 415);
		const match = request.headers["if-match"];
		return {
			meta: {
				principalId: who.principalId,
				scopeId: who.runId,
				idempotencyKey: parseContract(idempotencyKey, request.headers["idempotency-key"])
			},
			runId: who.runId,
			...match === void 0 ? {} : { ifMatch: parseContract(z.string().max(128), match) }
		};
	}
	router.get(base, guarded(async (request, response, identity) => {
		empty$3.parse(request.query);
		const b = await basis(subject(request, identity));
		response.setHeader("ETag", "\"r" + b.resourceRevision + "\"");
		response.json(b);
	}));
	router.get("/runs/:runId/candidates/:candidateId/acceptance/view", guarded(async (request, response, identity) => {
		empty$3.parse(request.query);
		const value = await basis(subject(request, identity)), page = acceptancePage(value, await getWorkbenchReturnContext(content, identity.principalId, value.runId));
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("Content-Security-Policy", page.policy);
		response.type("text/html; charset=utf-8").send(page.html);
	}));
	router.get("/runs/:runId/candidates/:candidateId/acceptance/client.js", guarded(async (request, response, identity) => {
		empty$3.parse(request.query);
		const who = subject(request, identity);
		await basis(who);
		const bytes = await readFile(new URL("./web/acceptance/acceptance-client.js", import.meta.url));
		await basis(who);
		response.type("application/javascript; charset=utf-8").send(bytes);
	}));
	router.get("/runs/:runId/candidates/:candidateId/acceptance/preparations", guarded(async (request, response, identity) => {
		const who = subject(request, identity), query = parseContract(page$1, request.query), candidate = await storage.request("getReleaseCandidate", who), policyHash = policies.get(candidate.projectId);
		const list = await storage.request("getCandidateAcceptancePreparationPage", {
			...who,
			...query,
			...policyHash ? { policyHash } : {}
		});
		await storage.request("getReleaseCandidate", who);
		response.json(parseContract(acceptancePreparationList, {
			...list,
			items: list.items.map((item) => ({
				...item,
				preparation: {
					...item.preparation,
					canCommit: Boolean(commit) && item.preparation.canCommit
				}
			}))
		}));
	}));
	router.get("/runs/:runId/candidates/:candidateId/acceptance/preparations/:operationId", guarded(async (request, response, identity) => {
		empty$3.parse(request.query);
		const who = subject(request, identity), value = await project(who, await original(who, parseContract(ids.operation, request.params.operationId)));
		response.setHeader("ETag", "\"r" + value.resourceRevision + "\"");
		response.json(value);
	}));
	router.post("/runs/:runId/candidates/:candidateId/acceptance/preparations", guarded(async (request, response, identity) => {
		const who = subject(request, identity), conditional = write(request, who), body = parseContract(beginAcceptanceInput, request.body), b = await basis(who);
		if (!b.canManage) fail$5("FORBIDDEN", 403);
		if (!await storage.request("lookupOperation", conditional.meta) && (!b.configured || body.policyHash !== b.policyHash)) fail$5("ACCEPTANCE_UNAVAILABLE", 503);
		const p = await storage.request("beginAcceptancePreparation", {
			...conditional,
			candidateId: who.candidateId,
			...body
		});
		response.status(202).json(await project(who, p));
	}));
	router.post("/runs/:runId/candidates/:candidateId/acceptance/replacement-confirmations", guarded(async (request, response, identity) => {
		const who = subject(request, identity), conditional = write(request, who), body = parseContract(confirmAcceptanceReplacementInput, request.body);
		response.status(201).json(parseContract(acceptanceReplacementReceipt, await storage.request("recordAcceptanceReplacementDecision", {
			...conditional,
			candidateId: who.candidateId,
			...body
		})));
	}));
	router.post("/runs/:runId/candidates/:candidateId/acceptance/preparations/:operationId/close-unsent", guarded(async (request, response, identity) => {
		const who = subject(request, identity), conditional = write(request, who), body = parseContract(closeUnsentAcceptanceInput, request.body), operationId = parseContract(ids.operation, request.params.operationId);
		await original(who, operationId);
		const p = await storage.request("failUnsentAcceptancePreparation", {
			...conditional,
			operationId,
			...body
		});
		response.json(await project(who, p));
	}));
	router.post("/runs/:runId/candidates/:candidateId/acceptance/preparations/:operationId/abort", guarded(async (request, response, identity) => {
		const who = subject(request, identity), conditional = write(request, who), body = parseContract(abortAcceptanceInput, request.body), preparationOperationId = parseContract(ids.operation, request.params.operationId);
		await original(who, preparationOperationId);
		const r = await storage.request("requestAcceptanceAbort", {
			...conditional,
			preparationOperationId,
			...body
		});
		response.status(202).json(parseContract(acceptanceAbortReceipt, {
			operationId: r.decision.operationId,
			preparationOperationId,
			decisionHash: r.decisionHash,
			reason: r.decision.reason,
			decidedAt: r.decision.decidedAt,
			decisionState: "RECORDED"
		}));
	}));
	router.post("/candidates/:candidateId\\:accept", guarded(async (request, response, identity) => {
		const body = parseContract(acceptCandidateInput, request.body), who = {
			principalId: identity.principalId,
			runId: body.runId,
			candidateId: parseContract(ids.candidate, request.params.candidateId)
		}, conditional = write(request, who), p = await original(who, body.preparationOperationId), b = await basis(who);
		if (!b.canManage) fail$5("FORBIDDEN", 403);
		const previous = await storage.request("lookupOperation", conditional.meta), input = {
			...conditional,
			...body,
			candidateId: who.candidateId
		};
		if (!previous && (!commit || !b.configured || b.policyHash !== p.policyHash)) fail$5("ACCEPTANCE_UNAVAILABLE", 503);
		const result = commit ? await commit(input) : previous?.status === "SUCCEEDED" ? await storage.request("commitReleaseAcceptance", input) : fail$5("ACCEPTANCE_UNAVAILABLE", 503);
		response.status(202).json(parseContract(acceptanceCommitReceipt, {
			...result,
			links: { preparation: "/api/v1/runs/" + who.runId + "/candidates/" + who.candidateId + "/acceptance/preparations/" + p.operationId }
		}));
	}));
}
//#endregion
//#region src/upload.ts
const limit = 2 * 1024 * 1024;
const totalLimit = 2129920;
function fail$4(code, status, message) {
	throw new StorageError(code, status, message);
}
async function receiveUpload(request, content, principalId, idempotencyKey) {
	const claimToken = randomUUID();
	const intake = await content.storage.request("claimUploadIntake", {
		meta: {
			principalId,
			scopeId: "uploads",
			idempotencyKey
		},
		claimToken
	});
	if (!intake.claimed && ["RECEIVING", "VALIDATED"].includes(intake.state)) fail$4("UPLOAD_IN_PROGRESS", 409, "Query the original upload operation before retrying");
	if (!intake.claimed && ["FAILED", "INTERRUPTED"].includes(intake.state)) fail$4(intake.errorCode ?? "UPLOAD_FAILED", 409, "The original upload failed; remove that item or start a new upload intent");
	let filePath;
	let staged;
	let aborted, bodyBytes = 0, fileBytes = 0, files = 0;
	const fields = {}, hash = createHash("sha256"), decoder = new TextDecoder("utf-8", { fatal: true });
	const streams = /* @__PURE__ */ new Set();
	const abort = (error) => {
		aborted ??= error;
		request.unpipe();
		for (const stream of streams) stream.destroy(error);
		request.resume();
	};
	const timer = setTimeout(() => abort(new StorageError("UPLOAD_TIMEOUT", 408, "Upload deadline exceeded")), 3e4);
	timer.unref();
	const disconnected = () => abort(new StorageError("UPLOAD_INTERRUPTED", 409, "Upload connection ended before completion"));
	request.once("aborted", disconnected);
	try {
		filePath = safePath(join(content.dataRoot, "staging"), intake.stagingKey, true);
		if (intake.claimed) staged = await open(filePath, "wx", 384);
		if (aborted) throw aborted;
		let parser;
		try {
			parser = Busboy({
				headers: request.headers,
				preservePath: true,
				defParamCharset: "utf8",
				limits: {
					fileSize: 2097153,
					files: 1,
					fields: 1,
					fieldNameSize: 64,
					fieldSize: 128,
					parts: 3
				}
			});
		} catch {
			fail$4("MULTIPART_INVALID", 422, "Expected a bounded multipart form");
		}
		let processing;
		const bounded = new Transform({ transform(chunk, _encoding, callback) {
			bodyBytes += chunk.length;
			if (bodyBytes > totalLimit) callback(new StorageError("UPLOAD_TOO_LARGE", 413, "Multipart body exceeds its byte budget"));
			else callback(null, chunk);
		} });
		streams.add(bounded);
		streams.add(parser);
		const complete = new Promise((resolve, reject) => {
			parser.once("close", resolve);
			parser.once("error", (error) => reject(error instanceof StorageError ? error : new StorageError("MULTIPART_INVALID", 422, "Multipart framing or headers are invalid")));
			bounded.once("error", reject);
			parser.on("field", (name, value, info) => {
				if (name !== "clientAttachmentId" || fields[name] !== void 0 || info.nameTruncated || info.valueTruncated) {
					abort(new StorageError("MULTIPART_INVALID", 422, "Unexpected or duplicate upload metadata"));
					return;
				}
				fields[name] = value;
			});
			parser.on("file", (name, stream, info) => {
				files++;
				streams.add(stream);
				stream.on("error", () => {});
				processing = (async () => {
					if (name !== "file" || files !== 1) fail$4("MULTIPART_INVALID", 422, "Exactly one file part is required");
					if (!["text/plain", "text/markdown"].includes(info.mimeType)) fail$4("ATTACHMENT_TYPE_INVALID", 422, "Only UTF-8 plain text and Markdown are supported");
					const filename = attachmentName.parse(info.filename);
					if (!/\.(md|markdown|txt)$/i.test(filename)) fail$4("ATTACHMENT_TYPE_INVALID", 422, "Use a Markdown or text filename");
					fields.name = filename;
					stream.once("limit", () => abort(new StorageError("UPLOAD_TOO_LARGE", 413, "Attachment exceeds 2 MiB")));
					for await (const chunk of stream) {
						const bytes = Buffer.from(chunk);
						fileBytes += bytes.length;
						if (fileBytes > limit) fail$4("UPLOAD_TOO_LARGE", 413, "Attachment exceeds 2 MiB");
						if (decoder.decode(bytes, { stream: true }).includes("\0")) fail$4("ATTACHMENT_ENCODING_INVALID", 422, "Attachment contains NUL bytes");
						hash.update(bytes);
						if (staged) await staged.writeFile(bytes);
					}
					if (decoder.decode().includes("\0")) fail$4("ATTACHMENT_ENCODING_INVALID", 422, "Attachment contains NUL bytes");
					if (stream.truncated) fail$4("UPLOAD_TOO_LARGE", 413, "Attachment exceeds 2 MiB");
					if (fileBytes === 0) fail$4("ATTACHMENT_EMPTY", 422, "Attachment is empty");
				})();
				processing.catch((error) => {
					abort(error instanceof TypeError ? new StorageError("ATTACHMENT_ENCODING_INVALID", 422, "Attachment must contain valid UTF-8") : error);
					reject(aborted);
				});
			});
			for (const name of [
				"filesLimit",
				"fieldsLimit",
				"partsLimit"
			]) parser.once(name, () => {
				const error = new StorageError("MULTIPART_INVALID", 422, "Multipart part limit exceeded");
				abort(error);
				reject(error);
			});
		});
		request.pipe(bounded).pipe(parser);
		await complete;
		await processing;
		if (aborted) throw aborted;
		if (files !== 1 || !fields.name) fail$4("MULTIPART_INVALID", 422, "Exactly one file part is required");
		const metadata = uploadMetadata.parse({
			clientAttachmentId: fields.clientAttachmentId,
			name: fields.name
		});
		if (staged) {
			await staged.sync();
			await staged.close();
			staged = void 0;
		}
		const contentHash = hash.digest("hex"), requestHash = createHash("sha256").update(canonical({
			...metadata,
			byteSize: fileBytes,
			contentHash
		})).digest("hex");
		const validated = await content.storage.request("validateUploadIntake", {
			principalId,
			intakeId: intake.intakeId,
			claimToken,
			...metadata,
			requestHash,
			contentHash,
			byteSize: fileBytes
		});
		if (!intake.claimed) return validated;
		const written = await content.put({
			meta: {
				principalId,
				scopeId: `upload.${intake.intakeId}`,
				idempotencyKey
			},
			expectedHash: contentHash,
			expectedSize: fileBytes,
			mimeType: /\.(md|markdown)$/i.test(metadata.name) ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
			target: {
				kind: "attachment",
				...metadata
			}
		}, createReadStream(filePath));
		if (typeof written.result?.attachmentId !== "string") fail$4("UPLOAD_RESULT_INVALID", 503, "Published attachment result is unavailable");
		return await content.storage.request("commitUploadIntake", {
			principalId,
			intakeId: intake.intakeId,
			claimToken,
			contentHash,
			attachmentId: written.result.attachmentId
		});
	} catch (error) {
		if (intake.claimed) await content.storage.request("failUploadIntake", {
			principalId,
			intakeId: intake.intakeId,
			claimToken,
			errorCode: error instanceof StorageError ? error.code : "UPLOAD_INVALID"
		}).catch(() => {});
		throw error;
	} finally {
		clearTimeout(timer);
		request.off("aborted", disconnected);
		if (staged) await staged.close();
		for (const stream of streams) stream.destroy();
	}
}
//#endregion
//#region src/release.ts
const empty$2 = z.strictObject({});
const missingConfiguration$1 = /* @__PURE__ */ new Set([
	"RELEASE_ACCESS_NOT_CONFIGURED",
	"RELEASE_ACCESS_GATE_MISSING",
	"RELEASE_SERVICE_NOT_CONFIGURED"
]);
function fail$3(code, status) {
	throw new StorageError(code, status, "Release entry requires its current member, exact target and configured gateway");
}
const subject$1 = (request, identity) => ({
	principalId: identity.principalId,
	runId: parseContract(ids.run, request.params.runId),
	releaseId: parseContract(ids.release, request.params.releaseId)
});
const actualOrigin$1 = (request) => `${request.socket.encrypted ? "https" : "http"}://${request.headers.host}`;
function configured$1(request, gateway) {
	if (!gateway || gateway.config.platformOrigin !== actualOrigin$1(request)) fail$3("RELEASE_ACCESS_NOT_CONFIGURED", 503);
	return gateway;
}
function mountReleaseRoutes(router, content, gateway, route) {
	const guarded = (handler) => route(async (request, response, identity) => {
		try {
			await handler(request, response, identity);
		} catch (error) {
			if (error instanceof StorageError && error.status === 404) fail$3("RESOURCE_NOT_FOUND", 404);
			const { code, status } = error;
			if (typeof code === "string" && missingConfiguration$1.has(code)) fail$3("RELEASE_ACCESS_NOT_CONFIGURED", 503);
			if (typeof code === "string" && code.startsWith("RELEASE_")) {
				if (status === 429) fail$3("LIMIT_EXCEEDED", 429);
				fail$3("RELEASE_UNAVAILABLE", status === 409 ? 409 : 503);
			}
			throw error;
		}
	});
	const base = "/runs/:runId/releases/:releaseId";
	async function snapshot(request, identity) {
		empty$2.parse(request.query);
		const who = subject$1(request, identity), read = () => content.storage.request("getReleasePublication", {
			principalId: who.principalId,
			releaseId: who.releaseId
		}), publication = await read();
		if (publication.runId !== who.runId) fail$3("RESOURCE_NOT_FOUND", 404);
		let state = !publication.isCurrentAccepted ? "NOT_CURRENT" : "RECOVERING";
		let access = null;
		if (publication.isCurrentAccepted && publication.state === "PUBLISHED") if (!gateway || gateway.config.platformOrigin !== actualOrigin$1(request)) state = "NOT_CONFIGURED";
		else try {
			access = await gateway.accessForMember(who);
			state = "AVAILABLE";
		} catch (error) {
			if (missingConfiguration$1.has(error.code ?? "")) state = "NOT_CONFIGURED";
		}
		const latest = await read();
		if (latest.runId !== who.runId) fail$3("RESOURCE_NOT_FOUND", 404);
		if (canonical(latest) !== canonical(publication)) {
			access = null;
			state = latest.isCurrentAccepted ? "RECOVERING" : "NOT_CURRENT";
		}
		return parseContract(releaseEntryView, {
			release: {
				releaseId: latest.releaseId,
				runId: latest.runId,
				candidateId: latest.request.preparation.candidateId,
				datasetId: latest.request.preparation.target.datasetId,
				revision: latest.revision,
				state: latest.state,
				isCurrentAccepted: latest.isCurrentAccepted,
				publishedAt: latest.proof?.publishedAt ?? null
			},
			access: {
				state,
				canWrite: access?.canWrite ?? false,
				releaseOrigin: access?.releaseOrigin ?? null,
				checkedAt: access?.checkedAt ?? null
			}
		});
	}
	router.get(base, guarded(async (request, response, identity) => {
		response.json(await snapshot(request, identity));
	}));
	router.post("/runs/:runId/releases/:releaseId/access", guarded(async (request, response, identity) => {
		empty$2.parse(request.query);
		if (!request.is("application/json")) fail$3("CONTENT_TYPE_INVALID", 415);
		empty$2.parse(request.body);
		const current = configured$1(request, gateway);
		if (request.headers.origin !== current.config.platformOrigin) fail$3("REQUEST_ORIGIN_INVALID", 403);
		response.json(parseContract(releaseAccessTicket, await current.issueForMember(subject$1(request, identity))));
	}));
	router.get("/runs/:runId/releases/:releaseId/view", guarded(async (request, response, identity) => {
		const view = await snapshot(request, identity), returnContext = await getWorkbenchReturnContext(content, identity.principalId, view.release.runId), nonce = randomBytes(18).toString("base64url"), origin = view.access.releaseOrigin;
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'${origin ? " " + origin : ""}; frame-src ${origin ?? "'none'"}; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`);
		response.type("text/html; charset=utf-8").send(releasePage(view, nonce, returnContext));
	}));
}
function releasePage(view, nonce, returnContext) {
	const labels = {
		AVAILABLE: view.access.canWrite ? "已发布应用可用" : "已发布应用可用（只读）",
		NOT_CONFIGURED: "已发布应用访问尚未配置",
		RECOVERING: "发布服务恢复中，请稍后重试",
		NOT_CURRENT: "此版本已不再是当前接受版本"
	};
	const settings = JSON.stringify({
		origin: view.access.releaseOrigin,
		accessPath: `/api/v1/runs/${encodeURIComponent(view.release.runId)}/releases/${encodeURIComponent(view.release.releaseId)}/access`
	}).replaceAll("<", "\\u003c");
	return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>已发布应用</title><style nonce="${nonce}">${workbenchReturnStyle}</style><body>${workbenchReturnNav(returnContext, nonce)}<main><h1>已发布应用</h1><p id="status" role="status">${labels[view.access.state] ?? "应用暂不可用"}</p><button id="open"${view.access.state === "AVAILABLE" ? "" : " disabled"}>打开应用</button><p>当前入口绑定已接受版本。</p><p><a href="/api/v1/releases/${encodeURIComponent(view.release.releaseId)}/exports/view">查看交付包</a></p><iframe id="release" title="生成已发布应用" sandbox="allow-scripts allow-forms allow-same-origin" referrerpolicy="no-referrer" hidden width="100%" height="640"></iframe></main><script nonce="${nonce}">
const settings=${settings},button=document.getElementById('open'),status=document.getElementById('status'),frame=document.getElementById('release');
button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='正在连接应用…';
  const signal=AbortSignal.timeout(15000);
  try{
    const issued=await fetch(settings.accessPath,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:'{}',signal});
    if(!issued.ok)throw Error('ACCESS');
    const ticket=await issued.json();if(ticket.releaseOrigin!==settings.origin)throw Error('ACCESS');
    const exchanged=await fetch(settings.origin+'/__devmesh/release/session',{method:'POST',credentials:'include',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({ticket:ticket.ticket,expiresAt:ticket.sessionExpiresAt}),signal});
    if(!exchanged.ok)throw Error('ACCESS');
    const session=await fetch(settings.origin+'/__devmesh/release/session',{credentials:'include',redirect:'error',cache:'no-store',signal});
    if(!session.ok)throw Error('COOKIE');
    frame.src=settings.origin+'/';frame.hidden=false;status.textContent='访问权限已确认，正在加载应用。';
  }catch(error){frame.hidden=true;frame.removeAttribute('src');status.textContent=error.message==='COOKIE'?'浏览器未保留应用访问权限，请检查跨站 Cookie 设置后重试。':'应用连接失败或权限已失效，请刷新页面后重试。';}
  finally{button.disabled=false;}
});
<\/script></body></html>`;
}
//#endregion
//#region src/preview.ts
const empty$1 = z.strictObject({});
const missingConfiguration = /* @__PURE__ */ new Set([
	"PREVIEW_ACCESS_NOT_CONFIGURED",
	"PREVIEW_WRITE_GATE_NOT_CONFIGURED",
	"PREVIEW_BACKEND_NOT_CONFIGURED"
]);
function fail$2(code, status) {
	throw new StorageError(code, status, "Preview entry requires its current member, exact target and configured gateway");
}
const subject = (request, identity) => ({
	principalId: identity.principalId,
	runId: parseContract(ids.run, request.params.runId),
	previewId: parseContract(ids.preview, request.params.previewId)
});
const actualOrigin = (request) => `${request.socket.encrypted ? "https" : "http"}://${request.headers.host}`;
function configured(request, gateway) {
	if (!gateway || gateway.config.platformOrigin !== actualOrigin(request)) fail$2("PREVIEW_ACCESS_NOT_CONFIGURED", 503);
	return gateway;
}
function mountPreviewRoutes(router, content, gateway, route) {
	const guarded = (handler) => route(async (request, response, identity) => {
		try {
			await handler(request, response, identity);
		} catch (error) {
			if (error instanceof StorageError && error.status === 404) fail$2("RESOURCE_NOT_FOUND", 404);
			const { code, status } = error;
			if (typeof code === "string" && missingConfiguration.has(code)) fail$2("PREVIEW_ACCESS_NOT_CONFIGURED", 503);
			if (typeof code === "string" && code.startsWith("PREVIEW_")) {
				if (status === 429) fail$2("LIMIT_EXCEEDED", 429);
				fail$2("PREVIEW_UNAVAILABLE", status === 409 ? 409 : 503);
			}
			throw error;
		}
	});
	const base = "/runs/:runId/previews/:previewId";
	async function snapshot(request, identity) {
		empty$1.parse(request.query);
		const who = subject(request, identity), preview = await content.storage.request("getPreview", who);
		let state = Date.parse(preview.expiresAt) <= Date.now() ? "EXPIRED" : preview.state === "READY" ? "RECOVERING" : preview.state;
		let access = null;
		if (state !== "EXPIRED" && preview.state === "READY") if (!gateway || gateway.config.platformOrigin !== actualOrigin(request)) state = "NOT_CONFIGURED";
		else try {
			access = await gateway.accessForMember(who);
			state = "AVAILABLE";
		} catch (error) {
			if (missingConfiguration.has(error.code ?? "")) state = "NOT_CONFIGURED";
		}
		await content.storage.request("getPreview", who);
		return parseContract(previewEntryView, {
			preview: {
				previewId: preview.previewId,
				runId: preview.runId,
				candidateId: preview.candidateId,
				datasetId: preview.datasetId,
				revision: preview.revision,
				state: preview.state,
				expiresAt: preview.expiresAt,
				healthState: preview.healthState,
				healthCheckedAt: preview.healthCheckedAt
			},
			access: {
				state,
				canWrite: access?.canWrite ?? false,
				previewOrigin: access?.previewOrigin ?? null
			}
		});
	}
	router.get(base, guarded(async (request, response, identity) => {
		response.json(await snapshot(request, identity));
	}));
	router.post("/runs/:runId/previews/:previewId/access", guarded(async (request, response, identity) => {
		empty$1.parse(request.query);
		if (!request.is("application/json")) fail$2("CONTENT_TYPE_INVALID", 415);
		empty$1.parse(request.body);
		const current = configured(request, gateway);
		if (request.headers.origin !== current.config.platformOrigin) fail$2("REQUEST_ORIGIN_INVALID", 403);
		response.json(parseContract(previewAccessTicket, await current.issueForMember(subject(request, identity))));
	}));
	router.get("/runs/:runId/previews/:previewId/view", guarded(async (request, response, identity) => {
		const view = await snapshot(request, identity), nonce = randomBytes(18).toString("base64url"), origin = view.access.previewOrigin;
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'${origin ? " " + origin : ""}; frame-src ${origin ?? "'none'"}; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`);
		response.type("text/html; charset=utf-8").send(previewPage(view, nonce));
	}));
	router.get("/runs/:runId/candidates/:candidateId/materials/:materialKey/download", guarded(async (request, response, identity) => {
		empty$1.parse(request.query);
		if (request.headers.range !== void 0) fail$2("RANGE_NOT_SUPPORTED", 416);
		const runId = parseContract(ids.run, request.params.runId), candidateId = parseContract(ids.candidate, request.params.candidateId), materialKey = parseContract(opaqueKey, request.params.materialKey), principalId = identity.principalId;
		const candidate = await content.storage.request("getReleaseCandidate", {
			principalId,
			runId,
			candidateId
		});
		const material = candidate.manifest.delivery.materials.find((m) => m.materialKey === materialKey);
		if (!material || material.contentHash !== material.expectedHash) fail$2("RESOURCE_NOT_FOUND", 404);
		const opened = await content.openRead(principalId, {
			kind: "releaseDelivery",
			operationId: candidate.manifest.delivery.record.operationId,
			materialKey
		});
		try {
			if (opened.content.contentHash !== material.expectedHash || opened.content.byteSize !== material.byteSize) fail$2("CONTENT_UNAVAILABLE", 503);
			await content.storage.request("getReleaseCandidate", {
				principalId,
				runId,
				candidateId
			});
			const filename = encodeURIComponent(material.path.split("/").at(-1) ?? "download").replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
			response.setHeader("Content-Type", "application/octet-stream");
			response.setHeader("Content-Length", material.byteSize);
			response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
			response.setHeader("Accept-Ranges", "none");
			response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox; frame-ancestors 'none'");
			await pipeline(opened.stream, response);
		} finally {
			opened.stream.destroy();
			await opened.release();
		}
	}));
}
function previewPage(view, nonce) {
	const labels = {
		AVAILABLE: view.access.canWrite ? "预览可用" : "预览可用（只读）",
		NOT_CONFIGURED: "预览访问尚未配置",
		RECOVERING: "预览恢复中，请稍后重试",
		STARTING: "预览启动中",
		STOPPING: "预览停止中",
		STOPPED: "预览已停止",
		EXPIRED: "预览已到期",
		UNKNOWN: "预览状态正在核实"
	};
	const settings = JSON.stringify({
		origin: view.access.previewOrigin,
		accessPath: `/api/v1/runs/${encodeURIComponent(view.preview.runId)}/previews/${encodeURIComponent(view.preview.previewId)}/access`
	}).replaceAll("<", "\\u003c");
	return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>应用预览</title><body><main><h1>应用预览</h1><p id="status" role="status">${labels[view.access.state] ?? "预览暂不可用"}</p><button id="open"${view.access.state === "AVAILABLE" ? "" : " disabled"}>打开预览</button><p>打开预览不会接受或发布此版本。</p><p><a href="/api/v1/runs/${encodeURIComponent(view.preview.runId)}/candidates/${encodeURIComponent(view.preview.candidateId)}/review/view">逐项审查此候选</a></p><iframe id="preview" title="生成应用预览" sandbox="allow-scripts allow-forms allow-same-origin" referrerpolicy="no-referrer" hidden width="100%" height="640"></iframe></main><script nonce="${nonce}">
const settings=${settings},button=document.getElementById('open'),status=document.getElementById('status'),frame=document.getElementById('preview');
button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='正在连接预览…';
  const signal=AbortSignal.timeout(15000);
  try{
    const issued=await fetch(settings.accessPath,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:'{}',signal});
    if(!issued.ok)throw Error('ACCESS');
    const ticket=await issued.json();if(ticket.previewOrigin!==settings.origin)throw Error('ACCESS');
    const exchanged=await fetch(settings.origin+'/__devmesh/preview/session',{method:'POST',credentials:'include',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({ticket:ticket.ticket,expiresAt:ticket.sessionExpiresAt}),signal});
    if(!exchanged.ok)throw Error('ACCESS');
    const session=await fetch(settings.origin+'/__devmesh/preview/session',{credentials:'include',redirect:'error',cache:'no-store',signal});
    if(!session.ok)throw Error('COOKIE');
    frame.src=settings.origin+'/';frame.hidden=false;status.textContent='访问权限已确认，正在加载预览。';
  }catch(error){frame.hidden=true;frame.removeAttribute('src');status.textContent=error.message==='COOKIE'?'浏览器未保留预览访问权限，请检查跨站 Cookie 设置后重试。':'预览连接失败或权限已失效，请刷新页面后重试。';}
  finally{button.disabled=false;}
});
<\/script></body></html>`;
}
//#endregion
//#region src/preview-management-page.ts
const css$1 = `:root{font-family:system-ui,sans-serif;color:#203b36;background:#f4f3ef}*{box-sizing:border-box}body{margin:0}main{max-width:1050px;margin:auto;padding:32px 24px 60px}h1{font-size:36px;margin:22px 0 10px}h2{font-size:21px}p{line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}a{color:#205a4d}button,input,textarea{font:inherit}button{min-height:44px;padding:10px 16px;border-radius:10px;background:#fff;color:#205a4d;border:1px solid #b4c7bd;cursor:pointer}button:disabled{opacity:.5;cursor:default}.primary{background:#205a4d;color:#fff}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #d99127;outline-offset:2px}.row,.actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.row{justify-content:space-between}.actions{margin:16px 0}.muted{color:#536b64;font-size:14px}.card,.version{padding:22px;border:1px solid #d2ded7;border-radius:16px;background:#fff;margin:16px 0}.version{background:#e8eee6}.hash{font-family:ui-monospace,Consolas,monospace;overflow-wrap:anywhere;font-size:13px}.notice{padding:14px 18px;background:#fff2d6;border:1px solid #e1cb8d;border-radius:12px}.badge{font-size:13px;padding:5px 10px;background:#edf1ef;border-radius:30px}label{display:block;margin:14px 0;line-height:1.7}input[type=checkbox]{margin:0 10px 0 0;width:18px;height:18px;vertical-align:middle}textarea{display:block;width:100%;border:1px solid #b6c8bc;border-radius:8px;padding:10px;background:#fff;color:#203b36;resize:vertical;min-height:90px}summary{cursor:pointer;padding:8px 0}dl{display:grid;grid-template-columns:135px minmax(0,1fr);gap:10px 18px}dt{color:#536b64}dd{margin:0;overflow-wrap:anywhere}input[type=number]{display:block;width:180px;max-width:100%;padding:8px;border:1px solid #b6c8bc;border-radius:8px}.history{border-top:1px solid #d2ded7;padding:14px 0}.selected{border-left:3px solid #205a4d;padding-left:16px}@media(max-width:600px){main{padding:24px 16px}h1{font-size:30px}.card,.version{padding:18px}dl{grid-template-columns:1fr;gap:6px}dd{margin-bottom:10px}}`;
function previewManagementPage(value, returnContext) {
	const nonce = randomBytes(18).toString("base64url");
	const json = JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
	return {
		policy: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`,
		html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>预览管理 · DevMesh</title><style nonce="${nonce}">${css$1}${workbenchReturnStyle}</style></head><body>${workbenchReturnNav(returnContext, nonce)}<div id="root"><main><h1>预览管理</h1><p>正在加载预览管理…</p><noscript>请启用JavaScript查看并管理预览。</noscript></main></div><script id="preview-management-data" type="application/json" nonce="${nonce}">${json}<\/script><script defer nonce="${nonce}" src="/api/v1/runs/${encodeURIComponent(value.runId)}/candidates/${encodeURIComponent(value.candidateId)}/preview-management/client.js"><\/script></body></html>`
	};
}
//#endregion
//#region src/preview-management.ts
const empty = z.strictObject({});
const cursor$1 = z.string().regex(/^(0|[1-9][0-9]*)$/).transform(Number).pipe(z.number().int().nonnegative().safe());
const page = z.strictObject({
	afterDatasetSequence: cursor$1.optional(),
	afterPreviewSequence: cursor$1.optional(),
	limit: z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().min(1).max(20)).optional()
});
const fail$1 = (code, status) => {
	throw new StorageError(code, status, "Exact candidate preview management unavailable");
};
function mountPreviewManagementRoutes(router, content, selected, route) {
	const policies = new Map(Object.entries(selected ?? {}).map(([projectId, policyHash]) => [ids.project.parse(projectId), sha256.parse(policyHash)])), storage = content.storage, base = "/runs/:runId/candidates/:candidateId/preview-management";
	const subject = (request, identity) => ({
		principalId: identity.principalId,
		runId: parseContract(ids.run, request.params.runId),
		candidateId: parseContract(ids.candidate, request.params.candidateId)
	});
	const guarded = (handler) => route(async (request, response, identity) => {
		try {
			await handler(request, response, identity);
		} catch (error) {
			if (error instanceof StorageError) {
				if (error.status === 404) fail$1("RESOURCE_NOT_FOUND", 404);
				if (error.code.startsWith("PREVIEW_") || error.code.startsWith("CANDIDATE_") || error.code.startsWith("RELEASE_CANDIDATE_")) fail$1("PREVIEW_UNAVAILABLE", error.status === 503 ? 503 : error.status === 422 ? 422 : 409);
			}
			throw error;
		}
	});
	async function scoped(who) {
		const c = await storage.request("getReleaseCandidate", who), policyHash = policies.get(c.projectId);
		return {
			...who,
			...policyHash ? { policyHash } : {}
		};
	}
	async function recheck(who) {
		await storage.request("getReleaseCandidate", who);
	}
	function conditional(request, who, scopeId = who.runId) {
		empty.parse(request.query);
		if (!request.is("application/json")) fail$1("CONTENT_TYPE_INVALID", 415);
		const match = request.headers["if-match"];
		return {
			meta: {
				principalId: who.principalId,
				scopeId,
				idempotencyKey: parseContract(idempotencyKey, request.headers["idempotency-key"])
			},
			runId: who.runId,
			...match === void 0 ? {} : { ifMatch: parseContract(z.string().max(128), match) }
		};
	}
	router.get("/runs/:runId/candidates/:candidateId/preview-management/view", guarded(async (request, response, identity) => {
		empty.parse(request.query);
		const who = subject(request, identity), value = parseContract(candidatePreviewWorkspace, await storage.request("getCandidatePreviewWorkspace", await scoped(who)));
		await recheck(who);
		const rendered = previewManagementPage(value, await getWorkbenchReturnContext(content, identity.principalId, value.runId));
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("Content-Security-Policy", rendered.policy);
		response.type("text/html; charset=utf-8").send(rendered.html);
	}));
	router.get("/runs/:runId/candidates/:candidateId/preview-management/client.js", guarded(async (request, response, identity) => {
		empty.parse(request.query);
		const who = subject(request, identity);
		await storage.request("getCandidatePreviewWorkspace", await scoped(who));
		const bytes = await readFile(new URL("./web/preview-management/preview-management-client.js", import.meta.url));
		await recheck(who);
		response.type("application/javascript; charset=utf-8").send(bytes);
	}));
	router.get(base, guarded(async (request, response, identity) => {
		const query = parseContract(page, request.query), who = subject(request, identity), value = parseContract(candidatePreviewWorkspace, await storage.request("getCandidatePreviewWorkspace", {
			...await scoped(who),
			...query
		}));
		await recheck(who);
		response.setHeader("ETag", "\"r" + value.resourceRevision + "\"");
		response.json(value);
	}));
	router.get("/runs/:runId/candidates/:candidateId/preview-management/datasets/:datasetId", guarded(async (request, response, identity) => {
		empty.parse(request.query);
		const who = subject(request, identity), value = parseContract(previewDatasetManagement, await storage.request("getCandidatePreviewDataset", {
			...await scoped(who),
			datasetId: parseContract(ids.dataset, request.params.datasetId)
		}));
		await recheck(who);
		response.json(value);
	}));
	router.get("/runs/:runId/candidates/:candidateId/preview-management/previews/:previewId", guarded(async (request, response, identity) => {
		empty.parse(request.query);
		const who = subject(request, identity), value = parseContract(previewManagement, await storage.request("getCandidatePreview", {
			...who,
			previewId: parseContract(ids.preview, request.params.previewId)
		}));
		await recheck(who);
		response.json(value);
	}));
	router.post("/runs/:runId/candidates/:candidateId/preview-management/datasets", guarded(async (request, response, identity) => {
		const who = subject(request, identity), write = conditional(request, who), body = parseContract(createPreviewDatasetInput, request.body), scope = await scoped(who), view = await storage.request("getCandidatePreviewWorkspace", scope);
		if (!view.canManage) fail$1("FORBIDDEN", 403);
		if (!await storage.request("lookupOperation", write.meta) && (!view.configured || body.policyHash !== view.policyHash)) fail$1("PREVIEW_UNAVAILABLE", 503);
		const d = await storage.request("createPreviewDataset", {
			...write,
			candidateId: who.candidateId,
			...body
		}), value = parseContract(previewDatasetManagement, await storage.request("getCandidatePreviewDataset", {
			...scope,
			datasetId: d.datasetId
		}));
		await recheck(who);
		response.status(202).json(value);
	}));
	router.post("/runs/:runId/candidates/:candidateId/preview-management/previews", guarded(async (request, response, identity) => {
		const who = subject(request, identity), write = conditional(request, who), body = parseContract(createPreviewIntentInput, request.body), scope = await scoped(who), view = await storage.request("getCandidatePreviewWorkspace", scope);
		if (!view.canManage) fail$1("FORBIDDEN", 403);
		const d = await storage.request("getPreviewDataset", {
			principalId: who.principalId,
			runId: who.runId,
			datasetId: body.datasetId
		});
		if (d.candidateId !== who.candidateId) fail$1("RESOURCE_NOT_FOUND", 404);
		if (!await storage.request("lookupOperation", write.meta) && (!view.configured || d.policyHash !== view.policyHash)) fail$1("PREVIEW_UNAVAILABLE", 503);
		const p = await storage.request("createPreviewIntent", {
			...write,
			candidateId: who.candidateId,
			...body
		}), value = parseContract(previewManagement, await storage.request("getCandidatePreview", {
			...who,
			previewId: p.previewId
		}));
		await recheck(who);
		response.status(202).json(value);
	}));
	router.post("/runs/:runId/candidates/:candidateId/preview-management/previews/:previewId/stop", guarded(async (request, response, identity) => {
		const who = subject(request, identity), previewId = parseContract(ids.preview, request.params.previewId), write = conditional(request, who, previewId), body = parseContract(stopPreviewIntentInput, request.body);
		await storage.request("getCandidatePreview", {
			...who,
			previewId
		});
		const p = await storage.request("stopPreviewIntent", {
			meta: write.meta,
			runId: who.runId,
			previewId,
			previewRevision: body.previewRevision,
			impactReviewHash: body.impactReviewHash,
			reason: "USER"
		}), value = parseContract(previewManagement, await storage.request("getCandidatePreview", {
			...who,
			previewId: p.previewId
		}));
		await recheck(who);
		response.status(202).json(value);
	}));
}
//#endregion
//#region src/web/workbench-context.ts
const workbenchSelection = z.strictObject({
	projectId: ids.project,
	runId: ids.run.optional()
});
const workbenchBoot = z.strictObject({
	principalId: opaqueKey,
	selection: workbenchSelection.nullable()
});
//#endregion
//#region src/workbench-page.ts
const css = `:root{font-family:system-ui,sans-serif;color:#203b36;background:#f4f3ef}*{box-sizing:border-box}body{margin:0}button,input,textarea,select{font:inherit}button,a{touch-action:manipulation}button{min-height:42px;padding:9px 13px;border:1px solid #b7c6bd;border-radius:9px;color:#245248;background:#fff;cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #d99127;outline-offset:2px}.primary{background:#245248;color:#fff}.bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:15px 22px;background:#fff;border-bottom:1px solid #d3ddd5}.bar .result-notice{flex-basis:100%;margin:0}.brand{font-weight:750;letter-spacing:.08em}.layout{display:grid;grid-template-columns:235px minmax(0,1fr) 330px;min-height:calc(100vh - 75px);max-width:1700px;margin:auto}.sidebar,.detail{padding:22px 18px}.sidebar{border-right:1px solid #d3ddd5}.detail{border-left:1px solid #d3ddd5;background:#eef1eb}.conversation{padding:26px;min-width:0}h1{font-size:30px;margin:0 0 12px}h2{font-size:19px}h3{font-size:16px}p{line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.muted{color:#587067;font-size:14px}.notice{padding:12px 16px;margin:15px 0;border:1px solid #ddc797;border-radius:10px;background:#fff4dc}.card{padding:18px;border:1px solid #d4ded6;border-radius:13px;background:#fff;margin:14px 0}.message{padding:17px 20px;background:#fff;border:1px solid #d4ded6;border-radius:12px;margin:14px 0}.message p{margin:9px 0}.project-list{display:flex;flex-direction:column;gap:9px;margin:16px 0}.project-list button{text-align:left;overflow-wrap:anywhere}.selected{background:#e0e9df;border-color:#7b9c89}.actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.tabs{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid #bdcdbf;padding-bottom:12px}.tabs button{min-width:48px;padding:9px}.tabs [aria-selected=true]{background:#245248;color:#fff}.composer label{display:block;margin:14px 0 6px}.composer input,.composer textarea,.composer select{width:100%;padding:11px;border:1px solid #b4c5b9;border-radius:9px;background:#fff;color:#203b36}.attachments{min-width:0}.attachments button{max-width:100%;overflow-wrap:anywhere}.attachments input[type=file]{max-width:100%}.composer input[type=checkbox]{width:18px;height:18px;padding:0;vertical-align:middle;margin-right:8px}.composer textarea{min-height:155px;resize:vertical;line-height:1.7}.status{font-size:14px;color:#587067;min-height:24px}.hash{font-family:ui-monospace,monospace;font-size:12px;overflow-wrap:anywhere}dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px}dd{margin:0;overflow-wrap:anywhere}summary{cursor:pointer;padding:8px 0}.mobile-nav{display:none}.danger{color:#8a3826}a{color:#245248}.planning{min-width:0}.planning nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.planning .card{padding:13px}.planning h4{margin-bottom:8px}.planning button{max-width:100%;overflow-wrap:anywhere}.planning article{margin:14px 0}.source-links{display:flex;gap:6px;flex-wrap:wrap}.source-text{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.7}.dag-scroll{max-width:100%;max-height:600px;overflow:auto;margin:12px 0}.dag-scroll svg{display:block;font-size:11px}.dag-scroll [role=button]{cursor:pointer}.dag-scroll [role=button]:focus-visible{outline:3px solid #d99127;outline-offset:2px}@media(max-width:1050px){.layout{grid-template-columns:200px minmax(0,1fr)}.detail{grid-column:2;border-left:0;border-top:1px solid #d3ddd5}}@media(max-width:700px){.bar{padding:12px 16px}.layout{display:block}.mobile-nav{display:flex;gap:7px;flex-wrap:wrap;width:100%}.layout [data-panel]{display:none}.layout [data-panel].visible{display:block}.sidebar,.detail{border:0;padding:20px 16px}.conversation{padding:22px 16px}h1{font-size:26px}.card{padding:16px}.bar .muted{width:100%}}`;
function workbenchPage(value) {
	const nonce = randomBytes(18).toString("base64url"), json = JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
	return {
		policy: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`,
		html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>工作台 · DevMesh</title><style nonce="${nonce}">${css}</style></head><body><div id="root"><main class="conversation"><h1>DevMesh 工作台</h1><p>正在加载工作台…</p><noscript>请启用JavaScript进入工作台。</noscript></main></div><script id="workbench-data" type="application/json" nonce="${nonce}">${json}<\/script><script defer nonce="${nonce}" src="/api/v1/workbench/client.js"><\/script></body></html>`
	};
}
//#endregion
//#region src/workbench-delivery.ts
const cursor = z.string().regex(/^(0|[1-9][0-9]{0,15})$/).transform(Number).pipe(z.number().int().safe().nonnegative());
const query$1 = z.strictObject({
	afterRevision: cursor.optional(),
	selectedCandidateId: ids.candidate.optional(),
	limit: z.string().regex(/^[1-9][0-9]?$/).transform(Number).pipe(z.number().int().min(1).max(20)).optional()
});
const missing = () => {
	throw new StorageError("RESOURCE_NOT_FOUND", 404, "Exact Run delivery is not visible");
};
function summary(value) {
	return parseContract(workbenchCandidateSummary, {
		candidateId: value.candidateId,
		revision: value.revision,
		manifestHash: value.manifestHash,
		codeCommit: value.codeCommit,
		createdAt: value.createdAt,
		qualification: value.qualification,
		automaticStatus: value.automaticStatus,
		reviewStatus: value.reviewStatus
	});
}
function mountWorkbenchDeliveryRoutes(router, content, route) {
	const guarded = (handler) => route(async (request, response, identity) => {
		try {
			await handler(request, response, identity);
		} catch (error) {
			if (error instanceof StorageError && error.status === 404) missing();
			throw error;
		}
	});
	router.get("/projects/:projectId/runs/:runId/delivery", guarded(async (request, response, identity) => {
		const projectId = parseContract(ids.project, request.params.projectId), runId = parseContract(ids.run, request.params.runId), q = parseContract(query$1, request.query), principalId = identity.principalId, storage = content.storage;
		const read = () => storage.request("getInputWorkspace", {
			principalId,
			projectId,
			runId,
			limit: 1
		}), before = await read();
		if (before.project.projectId !== projectId || before.run.runId !== runId || before.run.projectId !== projectId) missing();
		const page = await storage.request("listReleaseCandidates", {
			principalId,
			runId,
			afterRevision: q.afterRevision ?? 0,
			limit: q.limit ?? 20
		});
		let selectedCandidate = null;
		if (q.selectedCandidateId) {
			const exact = await storage.request("getReleaseCandidate", {
				principalId,
				runId,
				candidateId: q.selectedCandidateId
			});
			if (exact.projectId !== projectId || exact.runId !== runId || exact.candidateId !== q.selectedCandidateId) missing();
			selectedCandidate = summary({
				candidateId: exact.candidateId,
				revision: exact.revision,
				manifestHash: exact.manifestHash,
				codeCommit: exact.manifest.codeCommit,
				createdAt: exact.createdAt,
				qualification: exact.qualification,
				automaticStatus: exact.manifest.automaticStatus,
				reviewStatus: exact.manifest.reviewStatus
			});
		}
		let acceptedRelease = null;
		if (before.project.acceptedReleaseId !== null) {
			const release = parseContract(releaseExportEntryView, await storage.request("getReleaseExportEntry", {
				principalId,
				releaseId: before.project.acceptedReleaseId
			}));
			if ((await storage.request("checkInputAccess", {
				principalId,
				runId: release.runId
			})).projectId !== projectId || release.releaseId !== before.project.acceptedReleaseId || !release.isCurrentAccepted) throw new StorageError("BASIS_SUPERSEDED", 409, "Accepted release changed during this read");
			acceptedRelease = {
				...release,
				isCurrentAccepted: true
			};
		}
		const after = await read(), basis = (s) => canonical({
			project: s.project,
			run: s.run,
			mode: s.mode,
			membership: s.membership,
			eventCursor: s.eventCursor
		});
		if (basis(before) !== basis(after)) throw new StorageError("BASIS_SUPERSEDED", 409, "Workbench delivery changed during this read");
		response.json(parseContract(workbenchDeliveryView, {
			projectId,
			runId,
			resourceRevision: before.run.resourceRevision,
			projectRevision: before.project.revision,
			eventCursor: before.eventCursor,
			mode: before.mode,
			membership: before.membership,
			candidates: page.items.map(summary),
			nextRevision: page.nextRevision,
			selectedCandidate,
			acceptedRelease
		}));
	}));
}
//#endregion
//#region src/workbench.ts
const query = z.strictObject({
	projectId: ids.project.optional(),
	runId: ids.run.optional()
}).refine((v) => !v.runId || !!v.projectId, "Run requires project");
function mountWorkbenchRoutes(router, content, route) {
	mountWorkbenchDeliveryRoutes(router, content, route);
	router.get("/runs/:runId/sources", route(async (request, response, identity) => {
		const runId = parseContract(ids.run, request.params.runId), q = parseContract(z.strictObject({ ref: z.string().min(1).max(4096) }), request.query);
		let decoded;
		try {
			decoded = JSON.parse(q.ref);
		} catch {
			throw new StorageError("SCHEMA_INVALID", 422, "Source reference must be JSON");
		}
		const ref = parseContract(sourceRef, decoded), principalId = identity.principalId, record = await content.storage.request("getWorkbenchSource", {
			principalId,
			runId,
			ref
		});
		let body;
		if (record.requirement !== null) body = {
			kind: "requirement",
			requirement: record.requirement
		};
		else {
			const bytes = await content.readBytes(principalId, {
				kind: "artifact",
				artifactId: record.artifactId
			}, 2 * 1024 * 1024);
			if (createHash("sha256").update(bytes).digest("hex") !== record.contentHash) throw new StorageError("CONTENT_CORRUPT", 409, "Original source bytes differ");
			let text;
			try {
				text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
			} catch {
				throw new StorageError("CONTENT_TYPE_INVALID", 415, "Source is not UTF-8 text");
			}
			body = {
				kind: "text",
				text
			};
		}
		await content.storage.request("getWorkbenchSource", {
			principalId,
			runId,
			ref
		});
		response.json(parseContract(workbenchSourceView, {
			runId,
			ref,
			label: record.label,
			body
		}));
	}));
	router.get("/workbench/view", route(async (request, response, identity) => {
		const selected = parseContract(query, request.query), principalId = identity.principalId;
		if (selected.projectId) await content.storage.request("getInputWorkspace", {
			principalId,
			projectId: selected.projectId,
			...selected.runId ? { runId: selected.runId } : {},
			limit: 1
		});
		const rendered = workbenchPage(workbenchBoot.parse({
			principalId,
			selection: selected.projectId ? selected : null
		}));
		if (selected.projectId) await content.storage.request("checkInputAccess", {
			principalId,
			projectId: selected.projectId
		});
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("Content-Security-Policy", rendered.policy);
		response.type("text/html; charset=utf-8").send(rendered.html);
	}));
	router.get("/workbench/client.js", route(async (request, response) => {
		z.strictObject({}).parse(request.query);
		const bytes = await readFile(new URL("./web/workbench/workbench-client.js", import.meta.url));
		response.type("application/javascript; charset=utf-8").send(bytes);
	}));
	router.get("/workbench/return-client.js", route(async (request, response) => {
		z.strictObject({}).parse(request.query);
		const bytes = await readFile(new URL("./web/workbench-return/workbench-return-client.js", import.meta.url));
		response.type("application/javascript; charset=utf-8").send(bytes);
	}));
}
//#endregion
//#region src/index.ts
const runFile = promisify(execFile);
/** Resolve from a trusted repository, never a client path or commit field. */
async function resolveTemplateBaseline(repositoryRoot, commit, templatePath = "templates/web-crud-v1") {
	parseContract(gitCommit, commit);
	if (!/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(templatePath) || templatePath.split("/").some((p) => p === "..")) throw new Error("Invalid trusted template path");
	const { stdout: resolved } = await runFile("git", [
		"rev-parse",
		"--verify",
		`${commit}^{commit}`
	], {
		cwd: repositoryRoot,
		timeout: 3e4,
		maxBuffer: 1024
	});
	if (resolved.trim() !== commit) throw new Error("Template commit was not resolved exactly");
	const { stdout } = await runFile("git", ["show", `${commit}:${templatePath}/template.json`], {
		cwd: repositoryRoot,
		timeout: 3e4,
		maxBuffer: 64 * 1024
	});
	const version = JSON.parse(stdout).revision;
	if (typeof version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(version)) throw new Error("Template version is missing");
	return Object.freeze({
		version,
		baseCommit: commit
	});
}
function fail(code, status, message) {
	throw new StorageError(code, status, message);
}
const scalar = (value, name) => typeof value === "string" ? value : fail("SCHEMA_INVALID", 422, `${name} must occur once`);
const positive = (value, fallback, max) => {
	if (value === void 0) return fallback;
	const text = scalar(value, "limit");
	if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > max) fail("SCHEMA_INVALID", 422, "Invalid page size");
	return Number(text);
};
const scopeMeta = (principalId, scopeId, request) => ({
	principalId,
	scopeId,
	idempotencyKey: parseContract(idempotencyKey, request.headers["idempotency-key"])
});
function publicBoundary(request) {
	if (![
		"127.0.0.1",
		"::1",
		"::ffff:127.0.0.1"
	].includes(request.socket.remoteAddress ?? "")) fail("REQUEST_ORIGIN_INVALID", 403, "Input API requires its configured local transport");
	for (const name of [
		"host",
		"origin",
		"authorization",
		"cookie",
		"idempotency-key",
		"if-match",
		"x-devmesh-principal"
	]) {
		let count = 0;
		for (let i = 0; i < request.rawHeaders.length; i += 2) if (request.rawHeaders[i].toLowerCase() === name) count++;
		if (count > 1) fail("REQUEST_HEADERS_INVALID", 400, "Ambiguous request headers");
	}
	const host = request.socket.localAddress === "::1" ? `[::1]:${request.socket.localPort}` : `127.0.0.1:${request.socket.localPort}`;
	if (request.headers.host !== host) fail("REQUEST_HOST_INVALID", 403, "Unexpected request host");
	const protocol = request.socket.encrypted ? "https" : "http";
	if (request.headers.origin !== void 0 && request.headers.origin !== `${protocol}://${host}`) fail("REQUEST_ORIGIN_INVALID", 403, "Unexpected request origin");
	if (request.headers["sec-fetch-site"] === "cross-site") fail("REQUEST_ORIGIN_INVALID", 403, "Cross site input is not allowed");
	if (request.headers.cookie !== void 0) fail("COOKIE_AUTH_NOT_CONFIGURED", 401, "Cookie authentication is not configured");
}
function mountInputApi(app, content, options = { enabled: false }) {
	if (!options.enabled) return {
		enabled: false,
		stop: async () => {}
	};
	parseContract(gitCommit, options.baseline.baseCommit);
	parseContract(opaqueKey, options.baseline.version);
	const baseline = Object.freeze({ ...options.baseline }), maximumUploads = options.maximumUploads ?? 4;
	if (!Number.isInteger(maximumUploads) || maximumUploads < 1 || maximumUploads > 8) throw new Error("maximumUploads must be 1..8");
	let accepting = true, activeUploads = 0;
	const pending = /* @__PURE__ */ new Map(), identityControllers = /* @__PURE__ */ new Set();
	const router = express.Router(), identities = /* @__PURE__ */ new WeakMap(), requestIds = /* @__PURE__ */ new WeakMap();
	const route = (handler) => (request, response, next) => {
		const work = Promise.resolve().then(() => {
			if (!accepting) fail("SERVICE_STOPPING", 503, "Input API is stopping");
			return handler(request, response, identities.get(request));
		});
		pending.set(work, request);
		work.catch(next).finally(() => {
			pending.delete(work);
		});
	};
	router.use((request, response, next) => {
		const requestId = `req_${randomUUID().replaceAll("-", "")}`;
		requestIds.set(request, requestId);
		response.setHeader("Cache-Control", "no-store");
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.setHeader("X-Request-Id", requestId);
		const work = (async () => {
			try {
				if (!accepting) fail("SERVICE_STOPPING", 503, "Input API is stopping");
				publicBoundary(request);
				const resolver = options.identityResolver;
				if (!resolver) fail("IDENTITY_NOT_CONFIGURED", 503, "Identity provider is not configured");
				const controller = new AbortController();
				identityControllers.add(controller);
				const timer = setTimeout(() => controller.abort(new StorageError("SERVICE_UNAVAILABLE", 503, "Identity deadline exceeded")), 15e3);
				timer.unref();
				const disconnected = () => controller.abort(new StorageError("SERVICE_STOPPING", 503, "Identity request was disconnected"));
				request.once("aborted", disconnected);
				let abortListener;
				let identity;
				try {
					identity = await Promise.race([Promise.resolve().then(() => resolver(request, { signal: controller.signal })), new Promise((_resolve, reject) => {
						abortListener = () => reject(controller.signal.reason);
						controller.signal.addEventListener("abort", abortListener, { once: true });
					})]);
				} finally {
					clearTimeout(timer);
					request.off("aborted", disconnected);
					if (abortListener) controller.signal.removeEventListener("abort", abortListener);
					identityControllers.delete(controller);
				}
				if (!accepting) fail("SERVICE_STOPPING", 503, "Input API is stopping");
				if (!identity) fail("AUTHENTICATION_REQUIRED", 401, "Authentication is required");
				const principalId = parseContract(opaqueKey, identity.principalId), expected = request.headers["x-devmesh-principal"];
				if (expected !== void 0 && parseContract(opaqueKey, expected) !== principalId) fail("FORBIDDEN", 403, "Page identity has changed");
				identities.set(request, { principalId });
				next();
			} catch (error) {
				next(error);
			}
		})();
		pending.set(work, request);
		work.finally(() => {
			pending.delete(work);
		});
	});
	router.use(express.json({
		limit: 256 * 1024,
		strict: true,
		type: "application/json"
	}));
	const bodyMeta = (request, scope, identity) => scopeMeta(identity.principalId, scope, request);
	const json = (request) => {
		if (!request.is("application/json")) fail("CONTENT_TYPE_INVALID", 415, "Expected application/json");
		return request.body;
	};
	const putBody = async (principalId, scopeId, key, text) => {
		const bytes = Buffer.from(text, "utf8"), hash = createHash("sha256").update(bytes).digest("hex");
		await content.putBytes({
			principalId,
			scopeId: `body.${scopeId}`,
			idempotencyKey: key
		}, { kind: "content" }, bytes, "text/plain; charset=utf-8");
		return hash;
	};
	const receipt = (operation) => {
		const result = operation.result;
		if (!result || typeof result.projectId !== "string" || typeof result.runId !== "string" || typeof result.revision !== "number") fail("SERVICE_UNAVAILABLE", 503, "Original operation receipt is unavailable");
		return {
			...operation,
			resource: {
				projectId: result.projectId,
				runId: result.runId,
				revision: result.revision
			},
			links: { operation: `/api/v1/operations/${operation.operationId}` }
		};
	};
	router.post("/attachments", route(async (request, response, identity) => {
		const meta = bodyMeta(request, "uploads", identity);
		if (activeUploads >= maximumUploads) fail("UPLOAD_CAPACITY", 429, "Upload capacity is full");
		activeUploads++;
		try {
			const intake = await receiveUpload(request, content, identity.principalId, meta.idempotencyKey);
			if (intake.state !== "READY" || !intake.attachmentId) fail("UPLOAD_IN_PROGRESS", 409, "Query the original upload result");
			const attachment = await content.storage.request("getInputAttachment", {
				principalId: identity.principalId,
				attachmentId: intake.attachmentId
			});
			response.status(201).json({
				attachment,
				operationId: intake.operationId
			});
		} finally {
			activeUploads--;
		}
	}));
	router.get("/attachments/:attachmentId", route(async (request, response, identity) => {
		const attachmentId = parseContract(ids.attachment, request.params.attachmentId);
		response.json(await content.storage.request("getInputAttachment", {
			principalId: identity.principalId,
			attachmentId
		}));
	}));
	router.get("/attachments/:attachmentId/content", route(async (request, response, identity) => {
		const attachmentId = parseContract(ids.attachment, request.params.attachmentId), principalId = identity.principalId;
		const attachment = await content.storage.request("getInputAttachment", {
			principalId,
			attachmentId
		});
		if (attachment.state !== "READY") fail("RESOURCE_NOT_FOUND", 404, "Attachment has been removed");
		const bytes = await content.readBytes(principalId, {
			kind: "attachment",
			attachmentId
		}, 2 * 1024 * 1024);
		await content.storage.request("getInputAttachment", {
			principalId,
			attachmentId
		});
		response.type("text/plain; charset=utf-8").setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`);
		response.send(Buffer.from(bytes));
	}));
	router.delete("/attachments/:attachmentId", route(async (request, response, identity) => {
		response.json(await content.storage.request("removeInputAttachment", {
			principalId: identity.principalId,
			attachmentId: parseContract(ids.attachment, request.params.attachmentId)
		}));
	}));
	router.post("/projects", route(async (request, response, identity) => {
		const body = parseContract(createProjectInput, json(request)), meta = bodyMeta(request, "projects.create", identity);
		const name = body.name ?? ([...body.initialRequest.text.trim()].slice(0, 40).join("") || "新项目");
		const bodyHash = await putBody(identity.principalId, "projects.create", meta.idempotencyKey, body.initialRequest.text);
		const operation = await content.storage.request("createInputProject", {
			meta,
			name,
			baseCommit: baseline.baseCommit,
			bodyHash,
			attachmentIds: body.initialRequest.attachmentIds,
			clientDraftId: body.clientDraftId
		});
		response.status(201).json(receipt(operation));
	}));
	router.post("/projects/:projectId/tasks", route(async (request, response, identity) => {
		const body = parseContract(createTaskInput, json(request)), projectId = parseContract(ids.project, request.params.projectId), meta = bodyMeta(request, projectId, identity);
		await content.storage.request("checkInputAccess", {
			principalId: identity.principalId,
			projectId,
			write: true
		});
		const bodyHash = await putBody(identity.principalId, projectId, meta.idempotencyKey, body.goal.text);
		response.status(201).json(receipt(await content.storage.request("createInputTask", {
			meta,
			projectId,
			bodyHash,
			body,
			...request.headers["if-match"] !== void 0 ? { ifMatch: scalar(request.headers["if-match"], "If-Match") } : {}
		})));
	}));
	router.post("/runs/:runId/messages", route(async (request, response, identity) => {
		const body = parseContract(saveMessageInput, json(request)), runId = parseContract(ids.run, request.params.runId), meta = bodyMeta(request, runId, identity);
		await content.storage.request("checkInputAccess", {
			principalId: identity.principalId,
			runId,
			write: true
		});
		const bodyHash = await putBody(identity.principalId, runId, meta.idempotencyKey, body.text);
		response.status(202).json(receipt(await content.storage.request("appendInputMessage", {
			meta,
			runId,
			bodyHash,
			body,
			...request.headers["if-match"] !== void 0 ? { ifMatch: scalar(request.headers["if-match"], "If-Match") } : {}
		})));
	}));
	router.get("/runs/:runId/understanding", route(async (request, response, identity) => {
		const runId = parseContract(ids.run, request.params.runId);
		const requirementRevision = request.query.requirementRevision === void 0 ? void 0 : positive(request.query.requirementRevision, 1, Number.MAX_SAFE_INTEGER);
		response.json(await content.storage.request("getUnderstanding", {
			runId,
			principalId: identity.principalId,
			...requirementRevision === void 0 ? {} : { requirementRevision }
		}));
	}));
	router.post("/runs/:runId/questions\\:answer", route(async (request, response, identity) => {
		const runId = parseContract(ids.run, request.params.runId), meta = bodyMeta(request, runId, identity), body = parseContract(answerQuestionsInput, json(request));
		const ifMatch = request.headers["if-match"];
		response.status(202).json(receipt(await content.storage.request("answerPreparationQuestions", {
			meta,
			runId,
			body,
			...ifMatch === void 0 ? {} : { ifMatch: scalar(ifMatch, "If-Match") }
		})));
	}));
	router.post("/runs/:runId/understanding\\:retry", route(async (request, response, identity) => {
		const runId = parseContract(ids.run, request.params.runId), meta = bodyMeta(request, runId, identity), body = parseContract(retryUnderstandingInput, json(request));
		const ifMatch = request.headers["if-match"];
		response.status(202).json(receipt(await content.storage.request("retryPreparationInterpretation", {
			meta,
			runId,
			...body,
			...ifMatch === void 0 ? {} : { ifMatch: scalar(ifMatch, "If-Match") }
		})));
	}));
	router.get("/runs/:runId/plans", route(async (request, response, identity) => {
		const runId = parseContract(ids.run, request.params.runId);
		const planRevision = request.query.revision === void 0 ? void 0 : positive(request.query.revision, 1, Number.MAX_SAFE_INTEGER);
		const review = await content.storage.request("getPlanReview", {
			runId,
			principalId: identity.principalId,
			...planRevision === void 0 ? {} : { planRevision }
		});
		if (review.mode === "current") response.setHeader("ETag", `"r${review.resourceRevision}"`);
		response.json(review);
	}));
	router.post("/runs/:runId/plans/:planRevision\\:confirm", route(async (request, response, identity) => {
		const runId = parseContract(ids.run, request.params.runId), meta = bodyMeta(request, runId, identity), body = parseContract(commandBodies.ConfirmPlan, json(request));
		const planRevision = positive(request.params.planRevision, 1, Number.MAX_SAFE_INTEGER), ifMatch = request.headers["if-match"];
		response.status(202).json(receipt(await content.storage.request("confirmReviewedPlan", {
			meta,
			runId,
			planRevision,
			...body,
			...ifMatch === void 0 ? {} : { ifMatch: scalar(ifMatch, "If-Match") }
		})));
	}));
	router.get("/operations/lookup", route(async (request, response, identity) => {
		const includeAbsence = request.query.includeAbsence === void 0 ? "false" : scalar(request.query.includeAbsence, "includeAbsence");
		if (!["true", "false"].includes(includeAbsence)) fail("SCHEMA_INVALID", 422, "Invalid absence selection");
		const scope = parseContract(opaqueKey, request.query.scope), key = parseContract(idempotencyKey, request.query.key);
		const result = await content.storage.request("lookupInputOperation", {
			principalId: identity.principalId,
			scopeId: scope,
			idempotencyKey: key
		});
		if (includeAbsence === "true") {
			response.json({
				principalId: identity.principalId,
				scope,
				key,
				operation: result
			});
			return;
		}
		if (!result) fail("RESOURCE_NOT_FOUND", 404, "Original operation has not been recorded");
		response.json(result);
	}));
	router.get("/operations/:operationId", route(async (request, response, identity) => {
		response.json(await content.storage.request("getInputOperation", {
			principalId: identity.principalId,
			operationId: parseContract(ids.operation, request.params.operationId)
		}));
	}));
	router.get("/projects", route(async (request, response, identity) => {
		let cursor;
		if (request.query.cursor !== void 0) try {
			const encoded = scalar(request.query.cursor, "cursor");
			if (encoded.length > 1024) throw new Error();
			const value = Buffer.from(encoded, "base64url").toString("utf8");
			if (value.length > 512) throw new Error();
			cursor = JSON.parse(value);
		} catch {
			fail("SCHEMA_INVALID", 422, "Invalid project cursor");
		}
		const page = await content.storage.request("listInputProjects", {
			principalId: identity.principalId,
			limit: positive(request.query.limit, 20, 100),
			...cursor ? { cursor } : {}
		});
		response.json({
			...page,
			nextCursor: page.nextCursor ? Buffer.from(canonical(page.nextCursor)).toString("base64url") : null
		});
	}));
	router.get("/projects/:projectId/workspace", route(async (request, response, identity) => {
		const projectId = parseContract(ids.project, request.params.projectId), principalId = identity.principalId;
		const snapshot = await content.storage.request("getInputWorkspace", {
			principalId,
			projectId,
			...request.query.runId !== void 0 ? { runId: parseContract(ids.run, request.query.runId) } : {},
			...request.query.afterMessageId !== void 0 ? { afterMessageId: scalar(request.query.afterMessageId, "afterMessageId") } : {},
			limit: positive(request.query.limit, 50, 200)
		});
		const messages = [];
		for (const message of snapshot.messages) messages.push({
			...message,
			text: await content.readText(principalId, {
				kind: "artifact",
				artifactId: message.bodyArtifactId
			}, 256 * 1024)
		});
		await content.storage.request("checkInputAccess", {
			principalId,
			projectId
		});
		response.setHeader("ETag", `"r${snapshot.run.resourceRevision}"`);
		response.json({
			...snapshot,
			messages,
			templateBaseline: baseline
		});
	}));
	router.get("/projects/:projectId/runs/:runId/events", route(async (request, response, identity) => {
		const after = request.query.afterSeq === void 0 ? "0" : scalar(request.query.afterSeq, "afterSeq");
		if (!/^\d+$/.test(after) || !Number.isSafeInteger(Number(after))) fail("SCHEMA_INVALID", 422, "Invalid event cursor");
		response.json(await content.storage.request("listInputEvents", {
			principalId: identity.principalId,
			projectId: parseContract(ids.project, request.params.projectId),
			runId: parseContract(ids.run, request.params.runId),
			afterSeq: Number(after),
			limit: positive(request.query.limit, 50, 200)
		}));
	}));
	mountWorkbenchRoutes(router, content, route);
	mountPreviewRoutes(router, content, options.previewGateway, route);
	mountPreviewManagementRoutes(router, content, options.previewPolicies, route);
	mountExportRoutes(router, content, route);
	mountReviewRoutes(router, content, route);
	mountAcceptanceRoutes(router, content, options.acceptance, route);
	mountReleaseRoutes(router, content, options.releaseGateway, route);
	router.use((error, request, response, _next) => {
		const framework = error;
		const schemaFailure = error instanceof ContractError || Boolean(error && typeof error === "object" && "issues" in error);
		const originalStatus = error instanceof StorageError || error instanceof ContractError ? error.status : framework.type === "entity.too.large" ? 413 : framework.type === "entity.parse.failed" || schemaFailure ? 422 : 500;
		const candidate = error instanceof StorageError || error instanceof ContractError ? error.code : framework.type === "entity.too.large" ? "REQUEST_TOO_LARGE" : framework.type === "entity.parse.failed" ? "JSON_INVALID" : schemaFailure ? "SCHEMA_INVALID" : "SERVICE_UNAVAILABLE";
		const recognized = errorCode.safeParse(candidate).success, code = recognized ? candidate : "SERVICE_UNAVAILABLE", status = recognized ? originalStatus : 503;
		const requestId = requestIds.get(request) ?? `req_${randomUUID().replaceAll("-", "")}`;
		try {
			options.diagnostic?.({
				requestId,
				error
			});
		} catch {}
		if (!request.complete && !response.headersSent) {
			response.setHeader("Connection", "close");
			response.once("finish", () => request.destroy());
		}
		const details = error instanceof StorageError && ["PLAN_INVALID", "PLAN_SUPERSEDED"].includes(code) ? error.details : {};
		if (!response.headersSent && !response.destroyed) response.status(status).json({ error: {
			code,
			message: status >= 500 ? "Service is unavailable; query the original operation before retrying" : "Request could not be accepted",
			requestId,
			retryable: status >= 500 || status === 429,
			details
		} });
	});
	app.use("/api/v1", router);
	return {
		enabled: true,
		async stop() {
			accepting = false;
			for (const controller of identityControllers) controller.abort(new StorageError("SERVICE_STOPPING", 503, "Input API is stopping"));
			const timer = setTimeout(() => {
				for (const request of pending.values()) request.destroy();
			}, 1e4);
			timer.unref();
			try {
				await Promise.allSettled(pending.keys());
			} finally {
				clearTimeout(timer);
			}
		}
	};
}
//#endregion
export { mountInputApi, resolveTemplateBaseline };

//# sourceMappingURL=index.mjs.map