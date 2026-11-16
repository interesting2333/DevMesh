import { deliveryDataPlan, gitCommit, ids, opaqueKey, previewImageConfig, previewImageLimits, previewImageLimits as previewImageLimits$1, previewImageManifest, qualityBranch, qualityEvaluation, qualityExecution, qualityLimits, qualityLocation, qualityPath, qualityPolicy, qualityReport, qualitySourceScope, roleOutput, sha256 as sha256$1 } from "@devmesh/contracts";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { canonical as canonical$1, redactExportRecord } from "@devmesh/storage-sqlite";
//#region src/json.ts
var VerificationError = class extends Error {
	code;
	constructor(code) {
		super(code);
		this.code = code;
		this.name = "VerificationError";
	}
};
function reject$1(code) {
	throw new VerificationError(code);
}
function object(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return reject$1("REPORT_OBJECT_REQUIRED");
	return value;
}
function array(value, max) {
	if (!Array.isArray(value) || value.length > max) return reject$1("REPORT_ARRAY_INVALID");
	return value;
}
function integer(value) {
	if (!Number.isSafeInteger(value) || Number(value) < 0) return reject$1("REPORT_COUNTER_INVALID");
	return value;
}
function parseReportJson(bytes) {
	return parseBoundedJson(bytes, qualityLimits.reportBytes);
}
function parseSourceJson(bytes) {
	return parseBoundedJson(bytes, 16 * 1024 * 1024);
}
function parseBoundedJson(bytes, maximumBytes) {
	if (bytes.byteLength > maximumBytes) return reject$1("REPORT_TOO_LARGE");
	let text;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return reject$1("REPORT_UTF8_INVALID");
	}
	let i = 0, nodes = 0;
	const ws = () => {
		while (i < text.length && /[\x20\t\r\n]/.test(text[i])) i++;
	};
	const string = () => {
		const start = i++;
		while (i < text.length) {
			const c = text[i++];
			if (c === "\\") {
				i++;
				continue;
			}
			if (c === "\"") try {
				return JSON.parse(text.slice(start, i));
			} catch {
				return reject$1("REPORT_JSON_INVALID");
			}
		}
		return reject$1("REPORT_JSON_INVALID");
	};
	const value = (depth) => {
		if (depth > qualityLimits.jsonDepth || ++nodes > qualityLimits.jsonNodes) return reject$1("REPORT_COMPLEXITY_LIMIT");
		ws();
		const c = text[i];
		if (c === "\"") {
			string();
			return;
		}
		if (c === "{" || c === "[") {
			const close = c === "{" ? "}" : "]", keys = /* @__PURE__ */ new Set();
			i++;
			ws();
			if (text[i] === close) {
				i++;
				return;
			}
			for (;;) {
				if (c === "{") {
					if (text[i] !== "\"") return reject$1("REPORT_JSON_INVALID");
					const key = string();
					if (keys.has(key)) return reject$1("REPORT_DUPLICATE_KEY");
					keys.add(key);
					ws();
					if (text[i++] !== ":") return reject$1("REPORT_JSON_INVALID");
				}
				value(depth + 1);
				ws();
				if (text[i] === close) {
					i++;
					return;
				}
				if (text[i++] !== ",") return reject$1("REPORT_JSON_INVALID");
				ws();
			}
		}
		const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
		if (!token) return reject$1("REPORT_JSON_INVALID");
		i += token[0].length;
	};
	value(0);
	ws();
	if (i !== text.length) return reject$1("REPORT_JSON_INVALID");
	try {
		return JSON.parse(text);
	} catch {
		return reject$1("REPORT_JSON_INVALID");
	}
}
//#endregion
//#region src/source.ts
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
function canonical(value) {
	if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
	if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
	return JSON.stringify(value) ?? "undefined";
}
function qualityPolicyHash(value) {
	return sha256(canonical(qualityPolicy.parse(value)));
}
const escape = (c) => /[.*+?^${}()|[\]\\]/.test(c) ? "\\" + c : c;
function matchesGlob(path, glob) {
	const compile = (p) => {
		let out = "";
		for (let i = 0; i < p.length; i++) {
			const c = p[i];
			if (c === "*") if (p[i + 1] === "*") {
				i++;
				if (p[i + 1] === "/") {
					i++;
					out += "(?:.*/)?";
				} else out += ".*";
			} else out += "[^/]*";
			else if (c === "?") out += "[^/]";
			else if (c === "{") {
				const end = p.indexOf("}", i);
				if (end < 0 || p.slice(i + 1, end).includes("{")) return reject$1("QUALITY_GLOB_UNSUPPORTED");
				out += "(?:" + p.slice(i + 1, end).split(",").map(compile).join("|") + ")";
				i = end;
			} else if (c === "}" || c === "[" || c === "]") return reject$1("QUALITY_GLOB_UNSUPPORTED");
			else out += escape(c);
		}
		return out;
	};
	return new RegExp("^" + compile(glob) + "$").test(path);
}
const selectedBusiness = (path, policy) => policy.business.include.some((g) => matchesGlob(path, g)) && !policy.business.exclude.some((e) => matchesGlob(path, e.glob));
function normalizeReportPath(raw, prefixes) {
	if (typeof raw !== "string" || raw.length > 2048) return reject$1("REPORT_PATH_INVALID");
	const value = raw.replaceAll("\\", "/");
	let path = value;
	if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) {
		const matches = prefixes.filter((p) => value.startsWith(p + "/"));
		if (matches.length !== 1) return reject$1("REPORT_PATH_UNMAPPED");
		path = value.slice(matches[0].length + 1);
	}
	if (!qualityPath.safeParse(path).success) return reject$1("REPORT_PATH_INVALID");
	return path;
}
function uniquePaths(paths) {
	const folded = /* @__PURE__ */ new Set();
	for (const p of paths) {
		const key = p.toLowerCase();
		if (folded.has(key)) return reject$1("SOURCE_PATH_AMBIGUOUS");
		folded.add(key);
	}
}
function normalizeTopology(files) {
	return files.map((f) => ({
		...f,
		statements: [...f.statements].sort((a, b) => canonical(a).localeCompare(canonical(b), "en")),
		branches: [...f.branches].sort((a, b) => canonical(a).localeCompare(canonical(b), "en"))
	})).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function assertQualityScope(raw, policy) {
	const scope = qualitySourceScope.parse(raw);
	if (scope.checkConfigHash !== qualityPolicyHash(policy)) return reject$1("SOURCE_POLICY_STALE");
	uniquePaths(scope.gitManifest.map((f) => f.path));
	uniquePaths(scope.businessFiles.map((f) => f.path));
	const manifest = [...scope.gitManifest].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0), topology = normalizeTopology(scope.businessFiles);
	if (sha256(canonical(manifest)) !== scope.sourceManifestSha256 || sha256(canonical(topology)) !== scope.topologySha256) return reject$1("SOURCE_PROOF_HASH_MISMATCH");
	const expected = manifest.filter((f) => selectedBusiness(f.path, policy));
	if (canonical(expected.map((f) => f.path)) !== canonical(topology.map((f) => f.path))) return reject$1("SOURCE_SCOPE_INCOMPLETE");
	const covered = /* @__PURE__ */ new Set();
	for (const r of policy.reports.filter((r) => r.format === "istanbul-v1")) for (const f of expected) if (r.sourceInclude.some((g) => matchesGlob(f.path, g))) covered.add(f.path);
	if (expected.some((f) => !covered.has(f.path))) return reject$1("SOURCE_PRODUCER_MISSING");
	let positions = 0;
	for (const file of topology) {
		const source = expected.find((f) => f.path === file.path);
		const validate = (loc) => {
			for (const point of [loc.start, loc.end]) if (point.line > source.lineLengths.length || point.column > source.lineLengths[point.line - 1]) return reject$1("SOURCE_LOCATION_INVALID");
		};
		const unique = (items) => {
			if (new Set(items.map(canonical)).size !== items.length) return reject$1("SOURCE_POSITION_AMBIGUOUS");
		};
		unique(file.statements);
		unique(file.branches);
		for (const loc of file.statements) validate(loc);
		for (const b of file.branches) {
			validate(b.loc);
			if (b.locations.every((l) => l === null) || b.locations.some((l) => l === null) && b.type !== "if") return reject$1("SOURCE_BRANCH_INVALID");
			for (const loc of b.locations) if (loc) validate(loc);
			positions += b.locations.length;
		}
		positions += file.statements.length;
		if (positions > qualityLimits.positions) return reject$1("SOURCE_COMPLEXITY_LIMIT");
	}
	return {
		...scope,
		gitManifest: manifest,
		businessFiles: topology
	};
}
function freezeQualitySourceScope(input) {
	const policy = qualityPolicy.parse(input.policy), gitManifest = [...input.gitManifest].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0), businessFiles = normalizeTopology(input.businessFiles);
	return assertQualityScope({
		schemaVersion: "devmesh.quality-source.v1",
		targetCommit: input.targetCommit,
		checkConfigHash: qualityPolicyHash(policy),
		sourceManifestSha256: sha256(canonical(gitManifest)),
		topologySha256: sha256(canonical(businessFiles)),
		gitManifest,
		businessFiles
	}, policy);
}
//#endregion
//#region src/reports.ts
function location(raw, source, implicit = false) {
	const v = object(raw), start = object(v.start), end = object(v.end);
	if (implicit && !Object.keys(start).length && !Object.keys(end).length) return null;
	const point = (p, endPoint = false) => {
		const line = integer(p.line);
		if (line < 1 || line > source.lineLengths.length) return reject$1("REPORT_LOCATION_INVALID");
		const column = endPoint && p.column === null ? source.lineLengths[line - 1] : integer(p.column);
		if (column > source.lineLengths[line - 1]) return reject$1("REPORT_LOCATION_INVALID");
		return {
			line,
			column
		};
	};
	const parsed = qualityLocation.safeParse({
		start: point(start),
		end: point(end, true)
	});
	if (!parsed.success) return reject$1("REPORT_LOCATION_INVALID");
	return parsed.data;
}
function pairedKeys(map, counts) {
	const keys = Object.keys(map).sort();
	if (keys.some((k) => !/^(?:0|[1-9]\d{0,8})$/.test(k)) || canonical(keys) !== canonical(Object.keys(counts).sort())) return reject$1("REPORT_COUNTER_KEYS_MISMATCH");
	return keys;
}
function parseIstanbulReport(bytes, prefixes, sources) {
	const root = object(parseReportJson(bytes)), files = /* @__PURE__ */ new Map(), folded = /* @__PURE__ */ new Set(), sourceMap = new Map(sources.map((f) => [f.path, f]));
	if (Object.keys(root).length > qualityLimits.files) return reject$1("REPORT_FILE_LIMIT");
	let positions = 0;
	for (const [rawPath, raw] of Object.entries(root)) {
		const path = normalizeReportPath(rawPath, prefixes), entry = object(raw), source = sourceMap.get(path);
		if (!source) return reject$1("REPORT_SOURCE_UNKNOWN");
		if (normalizeReportPath(entry.path, prefixes) !== path) return reject$1("REPORT_SOURCE_PATH_MISMATCH");
		if (folded.has(path.toLowerCase())) return reject$1("REPORT_PATH_AMBIGUOUS");
		folded.add(path.toLowerCase());
		const statements = /* @__PURE__ */ new Map(), branches = /* @__PURE__ */ new Map();
		const sm = object(entry.statementMap), s = object(entry.s), bm = object(entry.branchMap), b = object(entry.b), fm = object(entry.fnMap), f = object(entry.f);
		for (const id of pairedKeys(sm, s)) {
			const loc = location(sm[id], source), key = canonical(loc);
			if (statements.has(key)) return reject$1("REPORT_POSITION_AMBIGUOUS");
			statements.set(key, {
				loc,
				hit: integer(s[id]) > 0
			});
			positions++;
		}
		for (const id of pairedKeys(bm, b)) {
			const rawBranch = object(bm[id]), locations = array(rawBranch.locations, 128).map((l) => location(l, source, true));
			const parsed = qualityBranch.safeParse({
				type: rawBranch.type,
				loc: location(rawBranch.loc, source),
				locations
			});
			if (!parsed.success || locations.every((l) => !l) || locations.some((l) => !l) && parsed.data.type !== "if") return reject$1("REPORT_BRANCH_INVALID");
			const hits = array(b[id], 128).map((n) => integer(n) > 0);
			if (hits.length !== locations.length) return reject$1("REPORT_BRANCH_COUNTER_MISMATCH");
			const key = canonical(parsed.data);
			if (branches.has(key)) return reject$1("REPORT_POSITION_AMBIGUOUS");
			branches.set(key, {
				branch: parsed.data,
				hits
			});
			positions += hits.length;
		}
		for (const id of pairedKeys(fm, f)) {
			const fn = object(fm[id]);
			location(fn.loc, source);
			location(fn.decl, source);
			integer(f[id]);
			positions++;
		}
		if (positions > qualityLimits.positions) return reject$1("REPORT_POSITION_LIMIT");
		files.set(path, {
			path,
			statements,
			branches
		});
	}
	return files;
}
const testIdentity = (path, fullName) => path + "\0" + fullName;
function parseVitestReport(bytes, prefixes) {
	const root = object(parseReportJson(bytes)), suites = array(root.testResults, qualityLimits.tests), cases = /* @__PURE__ */ new Map(), paths = /* @__PURE__ */ new Set();
	let failedSuites = 0;
	for (const raw of suites) {
		const suite = object(raw), path = normalizeReportPath(suite.name, prefixes);
		if (paths.has(path.toLowerCase())) return reject$1("TEST_SUITE_AMBIGUOUS");
		paths.add(path.toLowerCase());
		if (![
			"passed",
			"failed",
			"pending",
			"skipped",
			"todo"
		].includes(String(suite.status))) return reject$1("TEST_STATUS_UNKNOWN");
		if (suite.status !== "passed" || suite.message !== void 0 && suite.message !== "") failedSuites++;
		for (const rawCase of array(suite.assertionResults, qualityLimits.tests)) {
			const item = object(rawCase);
			if (typeof item.fullName !== "string" || !item.fullName.length || item.fullName.length > 4096) return reject$1("TEST_IDENTITY_INVALID");
			const id = testIdentity(path, item.fullName);
			if (cases.has(id)) return reject$1("TEST_IDENTITY_AMBIGUOUS");
			const status = item.status === "passed" ? "PASSED" : item.status === "failed" ? "FAILED" : [
				"pending",
				"skipped",
				"todo",
				"disabled"
			].includes(String(item.status)) ? "SKIPPED" : reject$1("TEST_STATUS_UNKNOWN");
			if (status === "PASSED" && item.failureMessages !== void 0 && array(item.failureMessages, 256).length) return reject$1("TEST_STATUS_CONTRADICTORY");
			cases.set(id, status);
			if (cases.size > qualityLimits.tests) return reject$1("TEST_CASE_LIMIT");
		}
	}
	const snapshot = root.snapshot === void 0 ? {} : object(root.snapshot);
	const runFailed = root.success !== true || failedSuites > 0 || snapshot.failure === true || typeof root.numRuntimeErrorTestSuites === "number" && root.numRuntimeErrorTestSuites > 0 || Array.isArray(root.unhandledErrors) && root.unhandledErrors.length > 0;
	return {
		cases,
		failedSuites,
		runFailed
	};
}
//#endregion
//#region src/evaluate.ts
const overall = (statuses) => statuses.includes("FAIL") ? "FAIL" : statuses.includes("STALE") ? "STALE" : statuses.includes("MISSING") ? "MISSING" : "PASS";
function executionStatus(e, producer, scope) {
	if (!e) return {
		status: "MISSING",
		codes: ["EXECUTION_MISSING"]
	};
	if (e.targetCommit !== scope.targetCommit || e.checkConfigHash !== scope.checkConfigHash || e.commandHash !== sha256(canonical(producer.command)) || e.imageDigest !== producer.imageDigest) return {
		status: "STALE",
		codes: ["EXECUTION_BASIS_STALE"]
	};
	if (e.state !== "EXITED" || e.exitCode === null || !e.startedAt || !e.finishedAt) return {
		status: "MISSING",
		codes: ["EXECUTION_OUTCOME_UNKNOWN"]
	};
	if (Date.parse(e.finishedAt) < Date.parse(e.startedAt) || e.exitCode !== 0 || e.errorCode || e.stopRequested) return {
		status: "FAIL",
		codes: ["EXECUTION_FAILED"]
	};
	return {
		status: "PASS",
		codes: []
	};
}
function compareTopology(files, report, scope) {
	const expected = scope.businessFiles.filter((f) => report.sourceInclude.some((g) => matchesGlob(f.path, g))), paths = new Set(expected.map((f) => f.path));
	if ([...files.keys()].some((p) => !paths.has(p))) return reject$1("REPORT_SOURCE_OUTSIDE_PRODUCER");
	for (const file of expected) {
		const actual = files.get(file.path);
		if (!actual) return reject$1("COVERAGE_FILE_MISSING");
		if (canonical([...actual.statements.keys()].sort()) !== canonical(file.statements.map(canonical).sort()) || canonical([...actual.branches.keys()].sort()) !== canonical(file.branches.map(canonical).sort())) return reject$1("COVERAGE_TOPOLOGY_STALE");
	}
}
function metric(covered, total, minimum, allowNA = false) {
	return {
		covered,
		total,
		minimum,
		status: total === 0 ? allowNA ? "NOT_APPLICABLE" : "FAIL" : BigInt(covered) * 100n >= BigInt(total) * BigInt(minimum) ? "PASS" : "FAIL"
	};
}
function coverageResult(check, policy, scope, parsed) {
	if (!scope.businessFiles.length) return {
		status: "FAIL",
		codes: ["COVERAGE_SCOPE_EMPTY"]
	};
	const lines = /* @__PURE__ */ new Map(), branches = /* @__PURE__ */ new Map();
	for (const f of scope.businessFiles) {
		for (const loc of f.statements) lines.set(f.path + "\0" + loc.start.line, false);
		for (const b of f.branches) for (let i = 0; i < b.locations.length; i++) branches.set(f.path + "\0" + canonical(b) + "\0" + i, false);
	}
	for (const id of check.reportIds) for (const f of parsed.get(id).coverage.values()) {
		for (const s of f.statements.values()) {
			const key = f.path + "\0" + s.loc.start.line;
			lines.set(key, lines.get(key) || s.hit);
		}
		for (const [key, b] of f.branches) for (let i = 0; i < b.hits.length; i++) {
			const id = f.path + "\0" + key + "\0" + i;
			branches.set(id, branches.get(id) || b.hits[i]);
		}
	}
	const coverage = {
		lines: metric([...lines.values()].filter(Boolean).length, lines.size, policy.thresholds.lines),
		branches: metric([...branches.values()].filter(Boolean).length, branches.size, policy.thresholds.branches, policy.zeroBranches === "complete-map-proves-none")
	};
	const codes = [];
	if (coverage.lines.status === "FAIL") codes.push(lines.size ? "COVERAGE_LINES_BELOW_MINIMUM" : "COVERAGE_LINES_EMPTY");
	if (coverage.branches.status === "FAIL") codes.push(branches.size ? "COVERAGE_BRANCHES_BELOW_MINIMUM" : "COVERAGE_BRANCHES_UNPROVEN");
	return {
		coverage,
		status: codes.length ? "FAIL" : "PASS",
		codes
	};
}
function evaluateQuality(input) {
	const policy = qualityPolicy.parse(input.policy), scope = assertQualityScope(input.scope, policy), executions = /* @__PURE__ */ new Map(), parsed = /* @__PURE__ */ new Map();
	if (input.executions.length > 16 || input.reports.length > 32) return reject$1("VERIFICATION_INPUT_LIMIT");
	const jobs = /* @__PURE__ */ new Set(), operations = /* @__PURE__ */ new Set();
	for (const raw of input.executions) {
		const e = qualityExecution.parse(raw);
		if (!policy.producers.some((p) => p.producerId === e.producerId)) return reject$1("EXECUTION_PRODUCER_UNKNOWN");
		if (executions.has(e.producerId)) return reject$1("EXECUTION_AMBIGUOUS");
		const job = e.runnerId + "\0" + e.jobId, operation = e.runnerId + "\0" + e.operationId;
		if (jobs.has(job) || operations.has(operation)) return reject$1("EXECUTION_JOB_REUSED");
		jobs.add(job);
		operations.add(operation);
		executions.set(e.producerId, e);
	}
	const required = new Map(policy.reports.map((r) => [r.reportId, r]));
	const seenOutputs = /* @__PURE__ */ new Set();
	for (const entry of input.reports) {
		const report = qualityReport.parse(entry.report), definition = required.get(report.reportId);
		if (!definition) return reject$1("REPORT_ID_UNKNOWN");
		if (parsed.has(report.reportId)) return reject$1("REPORT_ID_AMBIGUOUS");
		let result = {
			status: "PASS",
			codes: []
		};
		try {
			if (report.execution.producerId !== definition.producerId || canonical(executions.get(definition.producerId)) !== canonical(report.execution)) return reject$1("REPORT_EXECUTION_MISMATCH");
			const output = report.execution.runnerId + "\0" + report.execution.jobId + "\0" + report.outputPath;
			if (seenOutputs.has(output)) return reject$1("REPORT_OUTPUT_REUSED");
			seenOutputs.add(output);
			if (report.outputPath !== definition.path) return reject$1("REPORT_OUTPUT_PATH_MISMATCH");
			if (report.size !== entry.bytes.byteLength || sha256(entry.bytes) !== report.sha256) return reject$1("REPORT_BYTES_MISMATCH");
			if (report.execution.targetCommit !== scope.targetCommit || report.execution.checkConfigHash !== qualityPolicyHash(policy)) return reject$1("REPORT_BASIS_STALE");
			const producer = policy.producers.find((p) => p.producerId === definition.producerId);
			if (definition.format === "istanbul-v1") {
				result.coverage = parseIstanbulReport(entry.bytes, producer.pathPrefixes, scope.gitManifest);
				compareTopology(result.coverage, definition, scope);
			} else result.tests = parseVitestReport(entry.bytes, producer.pathPrefixes);
		} catch (error) {
			if (!(error instanceof VerificationError)) throw error;
			result = {
				status: error.code === "COVERAGE_FILE_MISSING" ? "MISSING" : error.code.endsWith("_STALE") ? "STALE" : "FAIL",
				codes: [error.code]
			};
		}
		parsed.set(report.reportId, result);
	}
	const checks = policy.checks.map((check) => {
		if (check.kind === "human") return {
			checkId: check.checkId,
			status: "PENDING",
			codes: ["HUMAN_REVIEW_REQUIRED"],
			reportIds: []
		};
		const facts = check.producerIds.map((id) => executionStatus(executions.get(id), policy.producers.find((p) => p.producerId === id), scope));
		const reports = check.reportIds.map((id) => parsed.get(id) ?? {
			status: "MISSING",
			codes: ["REPORT_MISSING"]
		});
		const prerequisites = overall([...facts, ...reports].map((f) => f.status)), codes = [...new Set([...facts, ...reports].flatMap((f) => f.codes))];
		const result = {
			checkId: check.checkId,
			status: prerequisites,
			codes,
			reportIds: check.reportIds
		};
		if (reports.some((r) => r.status !== "PASS")) return result;
		if (check.kind === "coverage") {
			const measured = coverageResult(check, policy, scope, parsed);
			return {
				...result,
				...measured,
				status: overall([prerequisites, measured.status]),
				codes: [.../* @__PURE__ */ new Set([...codes, ...measured.codes])]
			};
		}
		if (check.kind === "tests") {
			const actual = /* @__PURE__ */ new Map();
			let runFailed = false;
			for (const report of reports) {
				runFailed ||= report.tests.runFailed;
				for (const [id, status] of report.tests.cases) {
					if (actual.has(id)) return {
						...result,
						status: "FAIL",
						codes: ["TEST_IDENTITY_AMBIGUOUS"]
					};
					actual.set(id, status);
				}
			}
			const tests = {
				passed: 0,
				failed: 0,
				skipped: 0,
				missing: 0
			};
			for (const s of actual.values()) tests[s === "PASSED" ? "passed" : s === "FAILED" ? "failed" : "skipped"]++;
			for (const expected of check.requiredTests) if (!actual.has(testIdentity(expected.path, expected.fullName))) tests.missing++;
			if (runFailed) codes.push("TEST_RUN_FAILED");
			if (tests.failed) codes.push("TEST_FAILED");
			if (tests.skipped) codes.push("TEST_SKIPPED");
			if (tests.missing) codes.push("TEST_REQUIRED_MISSING");
			return {
				...result,
				tests,
				status: overall([prerequisites, runFailed || tests.failed || tests.skipped ? "FAIL" : tests.missing ? "MISSING" : "PASS"]),
				codes
			};
		}
		return result;
	});
	return qualityEvaluation.parse({
		schemaVersion: "devmesh.quality-evaluation.v1",
		targetCommit: scope.targetCommit,
		checkConfigHash: scope.checkConfigHash,
		sourceManifestSha256: scope.sourceManifestSha256,
		topologySha256: scope.topologySha256,
		automaticStatus: overall(checks.filter((c) => c.status !== "PENDING").map((c) => c.status)),
		reviewStatus: checks.some((c) => c.status === "PENDING") ? "PENDING" : "NOT_REQUIRED",
		checks
	});
}
//#endregion
//#region src/collector.ts
function sourceMatches(scope, manifest, verification) {
	if (scope.targetCommit !== verification.basis.targetCommit || scope.checkConfigHash !== verification.configHash || manifest.sha256 !== verification.basis.allocationManifestSha256 || scope.gitManifest.length !== manifest.files.length || scope.gitManifest.some((f) => !manifest.files.some((m) => m.path === f.path && m.sha256 === f.sha256))) return reject$1("QUALITY_SOURCE_MANIFEST_CHANGED");
}
function originalRunnerFact(job) {
	const { jobId, operationId, requestHash, request, state, exitCode, errorCode, stopRequested, stopEvidence, containerId, startedAt, endedAt, logCursor, outputRefs } = job;
	return {
		jobId: ids.job.parse(jobId),
		operationId: ids.operation.parse(operationId),
		requestHash,
		request,
		state,
		exitCode,
		errorCode,
		stopRequested,
		stopEvidence,
		containerId,
		startedAt,
		endedAt,
		executionProfile: job.executionProfile ?? null,
		logCursor,
		outputRefs
	};
}
/** Explicit service. It has no start, resend, renew, stop or shell execution path. */
var QualityCollector = class {
	storage;
	content;
	runner;
	sourceProvider;
	constructor(storage, content, runner, sourceProvider) {
		this.storage = storage;
		this.content = content;
		this.runner = runner;
		this.sourceProvider = sourceProvider;
	}
	async materials(subject) {
		return this.storage.request("listQualityMaterials", {
			principalId: subject.principalId,
			operationId: subject.operationId,
			afterKey: "",
			limit: 100
		});
	}
	async put(bound, descriptor, bytes) {
		if (descriptor.sha256 !== sha256(bytes) || descriptor.byteSize !== bytes.byteLength) return reject$1("QUALITY_MATERIAL_BYTES_CHANGED");
		const row = await this.storage.request("declareQualityMaterial", {
			...bound,
			descriptor
		});
		await this.content.put({
			meta: {
				principalId: bound.principalId,
				scopeId: bound.operationId,
				idempotencyKey: row.writeKey
			},
			target: {
				kind: "qualityMaterial",
				operationId: bound.operationId,
				materialKey: row.materialKey
			},
			expectedHash: descriptor.sha256,
			expectedSize: descriptor.byteSize,
			mimeType: descriptor.kind === "LOG" ? "text/plain; charset=utf-8" : "application/json"
		}, bytes);
		return row;
	}
	async read(subject, row) {
		const bytes = await this.content.readBytes(subject.principalId, {
			kind: "qualityMaterial",
			operationId: subject.operationId,
			materialKey: row.materialKey
		}, 16 * 1024 * 1024);
		if (bytes.byteLength !== row.descriptor.byteSize || sha256(bytes) !== row.descriptor.sha256) return reject$1("QUALITY_MATERIAL_BYTES_CHANGED");
		return bytes;
	}
	async prepare(input) {
		const verification = await this.storage.request("beginQualityVerification", input), bound = {
			principalId: input.principalId,
			operationId: input.operationId,
			requestHash: verification.requestHash
		};
		if ((await this.materials(bound)).some((r) => r.materialKey === "source" && r.contentHash)) return verification;
		if (!this.sourceProvider) return reject$1("QUALITY_SOURCE_PROVIDER_NOT_CONFIGURED");
		opaqueKey.parse(this.sourceProvider.providerId);
		sha256$1.parse(this.sourceProvider.toolchainHash);
		if (verification.qualification !== "CURRENT") return reject$1("QUALITY_BASIS_STALE");
		const { policy } = await this.storage.request("getQualityPolicy", {
			principalId: input.principalId,
			projectId: verification.projectId,
			configHash: verification.configHash
		}), manifest = await this.storage.request("getQualitySourceManifest", bound);
		const scope = assertQualityScope(await this.sourceProvider.prepare({
			verification,
			policy,
			manifest
		}), policy);
		if (scope.checkConfigHash !== qualityPolicyHash(policy)) return reject$1("QUALITY_SOURCE_MANIFEST_CHANGED");
		sourceMatches(scope, manifest, verification);
		const bytes = Buffer.from(canonical(scope));
		await this.put(bound, {
			kind: "SOURCE",
			sha256: sha256(bytes),
			byteSize: bytes.byteLength,
			allocationManifestSha256: manifest.sha256,
			sourceManifestSha256: scope.sourceManifestSha256,
			topologySha256: scope.topologySha256,
			instrumentation: {
				providerId: this.sourceProvider.providerId,
				toolchainHash: this.sourceProvider.toolchainHash
			}
		}, bytes);
		return this.storage.request("getQualityVerification", {
			principalId: bound.principalId,
			operationId: bound.operationId
		});
	}
	async bind(subject, binding) {
		const verification = await this.storage.request("getQualityVerification", subject);
		return this.storage.request("bindQualityStage", {
			...subject,
			requestHash: verification.requestHash,
			...binding
		});
	}
	/** Publish original report/result references after reading their retained bytes.
	* This private owner service never uploads Agent-supplied report identities. */
	async references(subject) {
		const verification = await this.storage.request("getQualityVerification", subject);
		if (verification.state !== "EVALUATED") return reject$1("QUALITY_NOT_EVALUATED");
		const rows = (await this.materials(subject)).filter((r) => ["REPORT", "RESULT"].includes(r.descriptor.kind));
		for (const row of rows) await this.read(subject, row);
		return this.storage.request("publishQualityArtifacts", {
			...subject,
			requestHash: verification.requestHash,
			contentHashes: [...new Set(rows.map((r) => r.contentHash))].sort()
		});
	}
	async collect(subject) {
		const verification = await this.storage.request("getQualityVerification", subject), bound = {
			...subject,
			requestHash: verification.requestHash
		};
		if (verification.state === "EVALUATED") return {
			state: "EVALUATED",
			verification
		};
		const { policy } = await this.storage.request("getQualityPolicy", {
			principalId: subject.principalId,
			projectId: verification.projectId,
			configHash: verification.configHash
		}), rows = await this.materials(subject), byKey = new Map(rows.map((r) => [r.materialKey, r])), source = byKey.get("source");
		if (!source?.contentHash || source.descriptor.kind !== "SOURCE" || !source.descriptor.instrumentation) return {
			state: "PENDING",
			verification,
			codes: ["QUALITY_SOURCE_NOT_PREPARED"]
		};
		const scope = assertQualityScope(parseSourceJson(await this.read(subject, source)), policy);
		sourceMatches(scope, await this.storage.request("getQualitySourceManifest", bound), verification);
		if (scope.targetCommit !== verification.basis.targetCommit || scope.sourceManifestSha256 !== source.descriptor.sourceManifestSha256 || scope.topologySha256 !== source.descriptor.topologySha256) return reject$1("QUALITY_SOURCE_MANIFEST_CHANGED");
		const stages = await this.storage.request("listQualityStages", bound), executions = [], reports = [], codes = [];
		for (const producer of policy.producers) {
			const stage = stages.find((s) => s.producerId === producer.producerId);
			if (!stage) {
				codes.push("QUALITY_STAGE_UNBOUND");
				continue;
			}
			const retained = byKey.get("log." + producer.producerId)?.contentHash && policy.reports.filter((r) => r.producerId === producer.producerId).every((r) => byKey.get("report." + r.reportId)?.contentHash);
			let original = stage.job;
			if (!retained) {
				let observed;
				try {
					observed = stage.job ? await this.runner.get(stage.job.jobId) : await this.runner.byOperation(stage.operationId);
				} catch (error) {
					if (error instanceof Error && "code" in error) {
						codes.push(String(error.code));
						continue;
					}
					throw error;
				}
				if (!original || stage.state !== "EXITED" || observed.state !== "EXITED") {
					codes.push("QUALITY_ORIGIN_OUTCOME_UNKNOWN");
					continue;
				}
				if (canonical(originalRunnerFact(observed)) !== canonical(original)) return reject$1("QUALITY_ORIGIN_FACT_CHANGED");
				original = originalRunnerFact(observed);
			}
			if (!original || stage.state !== "EXITED" || original.state !== "EXITED" || !original.executionProfile || !original.startedAt || !original.endedAt || !original.outputRefs[0]) {
				codes.push("QUALITY_ORIGIN_INCOMPLETE");
				continue;
			}
			const log = original.outputRefs[0], execution = qualityExecution.parse({
				producerId: producer.producerId,
				attemptId: verification.attemptId,
				runnerId: original.executionProfile.runnerId,
				jobId: original.jobId,
				operationId: original.operationId,
				requestHash: original.requestHash,
				targetCommit: verification.basis.targetCommit,
				checkConfigHash: verification.configHash,
				commandHash: original.executionProfile.commandHash,
				imageDigest: original.request.imageDigest,
				state: original.state,
				exitCode: original.exitCode,
				errorCode: original.errorCode,
				stopRequested: original.stopRequested,
				startedAt: original.startedAt,
				finishedAt: original.endedAt,
				log: {
					sha256: log.sha256,
					size: log.byteSize
				}
			});
			await this.storage.request("declareQualityOrigin", {
				...bound,
				producerId: producer.producerId,
				pipelineId: stage.pipelineId,
				ordinal: stage.ordinal,
				execution
			});
			executions.push(execution);
			try {
				const oldLog = byKey.get("log." + producer.producerId);
				if (oldLog?.contentHash) await this.read(subject, oldLog);
				else await this.put(bound, {
					kind: "LOG",
					producerId: producer.producerId,
					sha256: log.sha256,
					byteSize: log.byteSize
				}, await this.runner.output(original.jobId, 0, log, 16 * 1024 * 1024));
				const outputSpec = original.request.outputSpec;
				if (!Array.isArray(outputSpec)) return reject$1("QUALITY_ORIGIN_FACT_CHANGED");
				for (const definition of policy.reports.filter((r) => r.producerId === producer.producerId)) {
					const index = outputSpec.indexOf(definition.path), output = original.outputRefs[index + 1];
					if (index < 0 || !output) {
						codes.push("QUALITY_REPORT_MISSING");
						continue;
					}
					const old = byKey.get("report." + definition.reportId), bytes = old?.contentHash ? await this.read(subject, old) : await this.runner.output(original.jobId, index + 1, output, qualityLimits.reportBytes);
					const report = {
						reportId: definition.reportId,
						execution,
						outputPath: definition.path,
						sha256: output.sha256,
						size: output.byteSize
					};
					await this.put(bound, {
						kind: "REPORT",
						report,
						sha256: output.sha256,
						byteSize: output.byteSize
					}, bytes);
					reports.push({
						report,
						bytes
					});
				}
			} catch (error) {
				if (error instanceof Error && "code" in error && !(error instanceof VerificationError)) {
					codes.push(String(error.code));
					continue;
				}
				throw error;
			}
		}
		if (codes.length) return {
			state: "PENDING",
			verification: await this.storage.request("getQualityVerification", subject),
			codes: [...new Set(codes)]
		};
		const evaluation = evaluateQuality({
			policy,
			scope,
			executions,
			reports
		}), bytes = Buffer.from(canonical(evaluation));
		await this.put(bound, {
			kind: "RESULT",
			evaluation,
			sha256: sha256(bytes),
			byteSize: bytes.byteLength
		}, bytes);
		return {
			state: "EVALUATED",
			verification: await this.storage.request("completeQualityVerification", bound)
		};
	}
};
//#endregion
//#region src/work.ts
function reject(code) {
	throw new VerificationError(code);
}
/** Reads original artifacts and publishes one immutable assessment before applying it.
* No model, Job dispatch, command, or caller-supplied success decision is accepted. */
var WorkVerifier = class {
	storage;
	content;
	constructor(storage, content) {
		this.storage = storage;
		this.content = content;
	}
	completion(row) {
		const e = row.evaluation;
		if (!e.outcome || !row.artifactId || !row.contentHash) return reject("WORK_VERIFICATION_NOT_COMPLETABLE");
		return {
			meta: {
				principalId: row.principalId,
				scopeId: row.runId,
				idempotencyKey: row.completionKey
			},
			runId: row.runId,
			attemptId: row.attemptId,
			verificationOperationId: row.operationId,
			outcome: e.outcome,
			evidence: {
				artifactId: row.artifactId,
				sha256: row.contentHash
			},
			outputs: e.outputs,
			codeCommit: e.codeCommit
		};
	}
	async originalContent(row) {
		const principalId = row.principalId, ref = row.evaluation.candidate, bytes = await this.content.readBytes(principalId, {
			kind: "artifact",
			artifactId: ref.artifactId
		}, 2 * 1024 * 1024);
		if (sha256(bytes) !== ref.sha256 || sha256(canonical(roleOutput.parse(parseReportJson(bytes)))) !== ref.sha256) return reject("WORK_VERIFICATION_CANDIDATE_CHANGED");
		if (row.evaluation.qualityOperationId) {
			const materials = await this.storage.request("listQualityMaterials", {
				principalId,
				operationId: row.evaluation.qualityOperationId,
				limit: 100,
				afterKey: ""
			});
			for (const material of materials) {
				if (!material.contentHash) return reject("QUALITY_MATERIAL_UNAVAILABLE");
				const body = await this.content.readBytes(principalId, {
					kind: "qualityMaterial",
					operationId: material.operationId,
					materialKey: material.materialKey
				}, 16 * 1024 * 1024);
				if (sha256(body) !== material.contentHash || body.byteLength !== material.descriptor.byteSize) return reject("QUALITY_MATERIAL_BYTES_CHANGED");
			}
		}
	}
	async verify(input) {
		let row;
		try {
			row = await this.storage.request("getWorkVerification", {
				principalId: input.principalId,
				operationId: input.operationId
			});
		} catch (error) {
			if (!(error instanceof Error && "code" in error && error.code === "WORK_VERIFICATION_NOT_FOUND")) throw error;
		}
		if (row && row.principalId !== input.principalId) return reject("WORK_VERIFICATION_NOT_FOUND");
		if (row && (row.runId !== input.runId || row.attemptId !== input.attemptId || row.evaluation.qualityOperationId !== (input.qualityOperationId ?? null))) return reject("WORK_VERIFICATION_REQUEST_CHANGED");
		if (row?.state === "APPLIED") return {
			verification: row,
			completion: await this.storage.request("recordVerifiedWork", this.completion(row))
		};
		if (!row) {
			const { candidate } = await this.storage.request("getWorkVerificationCandidate", {
				principalId: input.principalId,
				runId: input.runId,
				attemptId: input.attemptId
			}), bytes = await this.content.readBytes(input.principalId, {
				kind: "artifact",
				artifactId: candidate.artifactId
			}, 2 * 1024 * 1024);
			if (sha256(bytes) !== candidate.sha256) return reject("WORK_VERIFICATION_CANDIDATE_CHANGED");
			row = await this.storage.request("beginWorkVerification", {
				...input,
				candidate: roleOutput.parse(parseReportJson(bytes))
			});
		}
		await this.originalContent(row);
		const body = Buffer.from(canonical(row.evaluation));
		if (sha256(body) !== row.expectedHash || body.byteLength !== row.byteSize) return reject("WORK_VERIFICATION_RESULT_CHANGED");
		await this.content.put({
			meta: {
				principalId: input.principalId,
				scopeId: row.operationId,
				idempotencyKey: row.writeKey
			},
			expectedHash: row.expectedHash,
			expectedSize: row.byteSize,
			mimeType: "application/json",
			target: {
				kind: "workVerification",
				operationId: row.operationId
			}
		}, body);
		row = await this.storage.request("getWorkVerification", {
			principalId: input.principalId,
			operationId: input.operationId
		});
		if (row.qualification !== "CURRENT") return reject("WORK_VERIFICATION_BASIS_STALE");
		if (!row.evaluation.outcome) return {
			verification: row,
			completion: null
		};
		const completion = await this.storage.request("recordVerifiedWork", this.completion(row));
		return {
			verification: await this.storage.request("getWorkVerification", {
				principalId: input.principalId,
				operationId: input.operationId
			}),
			completion
		};
	}
};
//#endregion
//#region src/repair.ts
/** Proposes a new immutable plan. Execution still waits for explicit confirmation. */
var RepairPlanner = class {
	storage;
	content;
	constructor(storage, content) {
		this.storage = storage;
		this.content = content;
	}
	async prepare(input) {
		let row = await this.storage.request("prepareVerifiedRepair", input);
		const body = Buffer.from(canonical(row.plan));
		if (sha256(body) !== row.expectedHash || body.byteLength !== row.byteSize) throw new VerificationError("VERIFIED_REPAIR_BYTES_CHANGED");
		await this.content.put({
			meta: {
				principalId: input.principalId,
				scopeId: row.operationId,
				idempotencyKey: row.writeKey
			},
			expectedHash: row.expectedHash,
			expectedSize: row.byteSize,
			mimeType: "application/json",
			target: {
				kind: "verifiedRepair",
				operationId: row.operationId
			}
		}, body);
		row = await this.storage.request("getVerifiedRepair", {
			principalId: input.principalId,
			operationId: input.operationId
		});
		return row;
	}
	async publish(principalId, operationId) {
		const row = await this.storage.request("getVerifiedRepair", {
			principalId,
			operationId
		});
		return this.storage.request("publishVerifiedRepair", {
			meta: {
				principalId,
				scopeId: row.runId,
				idempotencyKey: row.publishKey
			},
			runId: row.runId,
			operationId
		});
	}
};
//#endregion
//#region src/preview-image.ts
function parse(schema, bytes, limit) {
	if (bytes.byteLength > limit) return reject$1("PREVIEW_IMAGE_JSON_LIMIT");
	const value = schema.safeParse(parseSourceJson(bytes));
	if (!value.success) return reject$1("PREVIEW_IMAGE_PROFILE_INVALID");
	return value.data;
}
/** Content identity only: no extraction, process, filesystem, network or tag
* resolution. A separate original approved build Job must prove provenance. */
function verifyPreviewImage(input) {
	if (!gitCommit.safeParse(input.targetCommit).success || !sha256$1.safeParse(input.buildArtifactHash).success) return reject$1("PREVIEW_IMAGE_BASIS_INVALID");
	const imageDigest = "sha256:" + sha256(input.manifestBytes);
	if (input.expectedDigest !== void 0 && input.expectedDigest !== imageDigest) return reject$1("PREVIEW_IMAGE_DIGEST_CHANGED");
	const manifest = parse(previewImageManifest, input.manifestBytes, previewImageLimits.manifestBytes), required = /* @__PURE__ */ new Set([manifest.config.digest, ...manifest.layers.map((l) => l.digest)]);
	if (input.blobs.size !== required.size || [...input.blobs.keys()].some((key) => !required.has(key))) return reject$1("PREVIEW_IMAGE_BLOB_SET_CHANGED");
	let bytes = input.manifestBytes.byteLength, expanded = 0;
	function blob(d) {
		const value = input.blobs.get(d.digest);
		if (!value || value.byteLength !== d.size || value.byteLength > previewImageLimits.blobBytes || "sha256:" + sha256(value) !== d.digest) return reject$1("PREVIEW_IMAGE_BLOB_CHANGED");
		bytes += value.byteLength;
		if (bytes > previewImageLimits.totalBytes) return reject$1("PREVIEW_IMAGE_TOTAL_LIMIT");
		return value;
	}
	const config = parse(previewImageConfig, blob(manifest.config), previewImageLimits.configBytes);
	if (config.config.Labels["org.opencontainers.image.revision"] !== input.targetCommit || config.config.Labels["io.devmesh.build.sha256"] !== input.buildArtifactHash) return reject$1("PREVIEW_IMAGE_SOURCE_CHANGED");
	if (config.rootfs.diff_ids.length !== manifest.layers.length) return reject$1("PREVIEW_IMAGE_ROOTFS_CHANGED");
	const layers = manifest.layers.map((layer, index) => {
		const original = blob(layer);
		let unpacked = original;
		if (layer.mediaType.endsWith("+gzip")) try {
			unpacked = gunzipSync(original, { maxOutputLength: previewImageLimits.blobBytes });
		} catch {
			return reject$1("PREVIEW_IMAGE_LAYER_INVALID");
		}
		expanded += unpacked.byteLength;
		if (expanded > previewImageLimits.totalBytes) return reject$1("PREVIEW_IMAGE_EXPANDED_LIMIT");
		const diffId = "sha256:" + sha256(unpacked);
		if (diffId !== config.rootfs.diff_ids[index]) return reject$1("PREVIEW_IMAGE_ROOTFS_CHANGED");
		return {
			digest: layer.digest,
			diffId,
			byteSize: original.byteLength,
			expandedByteSize: unpacked.byteLength
		};
	});
	return {
		schemaVersion: "devmesh.preview-image-identity.v1",
		imageDigest,
		configDigest: manifest.config.digest,
		targetCommit: input.targetCommit,
		buildArtifactHash: input.buildArtifactHash,
		os: config.os,
		architecture: config.architecture,
		layers
	};
}
//#endregion
//#region src/delivery.ts
/** Collects only the approved original Job's fixed outputs. No execution path. */
var DeliveryCollector = class {
	storage;
	content;
	runner;
	constructor(storage, content, runner) {
		this.storage = storage;
		this.content = content;
		this.runner = runner;
	}
	async collect(input) {
		const delivery = await this.storage.request("beginReleaseDelivery", input);
		if (delivery.state === "READY") return delivery;
		if (delivery.qualification !== "CURRENT") return reject$1("RELEASE_DELIVERY_BASIS_STALE");
		const subject = {
			principalId: input.principalId,
			operationId: input.operationId
		}, bound = {
			...subject,
			requestHash: delivery.requestHash
		}, origin = await this.storage.request("getReleaseDeliveryOrigin", bound), rows = await this.storage.request("listReleaseDeliveryMaterials", subject), bytes = /* @__PURE__ */ new Map();
		if (rows.some((row) => !row.contentHash)) {
			if (!this.runner) return reject$1("DELIVERY_RUNNER_NOT_CONFIGURED");
			if (canonical(originalRunnerFact(await this.runner.get(origin.job.jobId))) !== canonical(origin.job)) return reject$1("DELIVERY_ORIGIN_FACT_CHANGED");
		}
		for (const row of rows) {
			const target = {
				kind: "releaseDelivery",
				operationId: input.operationId,
				materialKey: row.materialKey
			};
			let value;
			if (row.contentHash) value = await this.content.readBytes(input.principalId, target, previewImageLimits$1.blobBytes);
			else {
				value = await this.runner.output(origin.job.jobId, row.outputIndex, {
					sha256: row.expectedHash,
					byteSize: row.byteSize
				}, previewImageLimits$1.blobBytes);
				this.check(row, value);
				await this.content.put({
					meta: {
						principalId: input.principalId,
						scopeId: input.operationId,
						idempotencyKey: row.writeKey
					},
					target,
					expectedHash: row.expectedHash,
					expectedSize: row.byteSize,
					mimeType: "application/octet-stream"
				}, value);
			}
			this.check(row, value);
			bytes.set(row.materialKey, value);
		}
		const imageRows = rows.filter((row) => row.materialKey === "image.config" || row.materialKey.startsWith("image.layer."));
		const image = verifyPreviewImage({
			targetCommit: delivery.basis.targetCommit,
			buildArtifactHash: sha256(bytes.get("build")),
			manifestBytes: bytes.get("image.manifest"),
			expectedDigest: "sha256:" + rows.find((row) => row.materialKey === "image.manifest").expectedHash,
			blobs: new Map(imageRows.map((row) => ["sha256:" + row.expectedHash, bytes.get(row.materialKey)]))
		});
		const parsed = deliveryDataPlan.safeParse(parseSourceJson(bytes.get("data.plan")));
		if (!parsed.success) return reject$1("DELIVERY_DATA_PLAN_INVALID");
		return this.storage.request("completeReleaseDelivery", {
			...bound,
			image,
			dataPlan: parsed.data
		});
	}
	check(row, bytes) {
		if (bytes.byteLength !== row.byteSize || sha256(bytes) !== row.expectedHash) return reject$1("DELIVERY_MATERIAL_BYTES_CHANGED");
	}
};
//#endregion
//#region src/freeze.ts
/** Actual bytes are read before a basis-checked Worker transaction. No execution. */
var CandidateFreezer = class {
	storage;
	content;
	constructor(storage, content) {
		this.storage = storage;
		this.content = content;
	}
	async freeze(input) {
		const principalId = input.meta.principalId, old = await this.storage.request("lookupOperation", input.meta);
		if (old) {
			if (old.status !== "SUCCEEDED" || typeof old.result?.candidateId !== "string") return reject$1("IDEMPOTENCY_KEY_REUSED");
			const original = await this.storage.request("getReleaseCandidate", {
				principalId,
				runId: input.runId,
				candidateId: old.result.candidateId
			});
			return this.storage.request("freezeReleaseCandidate", {
				...input,
				basisHash: original.manifestHash,
				contentHashes: original.preflightHashes
			});
		}
		const prepared = await this.storage.request("prepareReleaseCandidateFreeze", {
			principalId,
			runId: input.runId,
			integrationOperationId: input.integrationOperationId,
			deliveryOperationId: input.deliveryOperationId
		}), manifest = prepared.manifest, queue = [], queued = /* @__PURE__ */ new Set(), candidates = new Set(manifest.works.map((w) => w.assessment.candidate.sha256));
		const add = (reference, hash) => {
			if (!queued.has(hash)) {
				if (queued.size >= 2048) return reject$1("RELEASE_CANDIDATE_CONTENT_LIMIT");
				queued.add(hash);
				queue.push({
					reference,
					sha256: hash
				});
			}
		};
		function artifacts(value) {
			if (Array.isArray(value)) {
				for (const v of value) artifacts(v);
				return;
			}
			if (!value || typeof value !== "object") return;
			const v = value;
			if (typeof v.artifactId === "string" && typeof v.sha256 === "string") add({
				kind: "artifact",
				artifactId: v.artifactId
			}, v.sha256);
			for (const child of Object.values(v)) artifacts(child);
		}
		artifacts(manifest);
		for (const q of manifest.quality) for (const m of q.materials) add({
			kind: "qualityMaterial",
			operationId: q.verification.operationId,
			materialKey: m.materialKey
		}, m.contentHash);
		for (const m of manifest.delivery.materials) add({
			kind: "releaseDelivery",
			operationId: manifest.delivery.record.operationId,
			materialKey: m.materialKey
		}, m.contentHash);
		let total = 0;
		for (let index = 0; index < queue.length; index++) {
			const ref = queue[index], bytes = await this.content.readBytes(principalId, ref.reference, 64 * 1024 * 1024);
			total += bytes.byteLength;
			if (total > 512 * 1024 * 1024) return reject$1("RELEASE_CANDIDATE_CONTENT_LIMIT");
			if (sha256(bytes) !== ref.sha256) return reject$1("RELEASE_CANDIDATE_CONTENT_CHANGED");
			if (candidates.has(ref.sha256)) {
				const parsed = roleOutput.safeParse(parseSourceJson(bytes));
				if (!parsed.success || sha256(canonical(parsed.data)) !== ref.sha256) return reject$1("RELEASE_CANDIDATE_CONTENT_CHANGED");
				artifacts(parsed.data);
			}
		}
		return this.storage.request("freezeReleaseCandidate", {
			...input,
			basisHash: prepared.manifestHash,
			contentHashes: [...queued].sort()
		});
	}
};
//#endregion
//#region src/export-zip.ts
var ExportError = class extends Error {
	code;
	constructor(code) {
		super(code);
		this.code = code;
	}
};
const exportLimits = Object.freeze({
	entries: 2e4,
	entryBytes: 64 * 1024 * 1024,
	archiveBytes: 200 * 1024 * 1024
});
function exportPath(path) {
	if (path.length > 2048 || path !== path.normalize("NFC") || [...path].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) || path.includes("\\") || path.startsWith("/") || path.split("/").some((p) => !p || p === "." || p === ".." || /[:<>"|?*]/.test(p) || /[. ]$/.test(p) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new ExportError("EXPORT_PATH_INVALID");
	return path;
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
	for (let j = 0; j < 8; j++) n = n & 1 ? 3988292384 ^ n >>> 1 : n >>> 1;
	return n >>> 0;
});
function crc32(bytes) {
	let crc = 4294967295;
	for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ crc >>> 8;
	return (crc ^ 4294967295) >>> 0;
}
/** Deterministic ZIP32 STORE: no extraction, compression, symlinks or execution. */
function buildExportZip(input) {
	if (input.length > exportLimits.entries) throw new ExportError("EXPORT_LIMIT_EXCEEDED");
	const files = [...input].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0), seen = /* @__PURE__ */ new Set();
	let offset = 0, total = 22;
	for (const f of files) {
		exportPath(f.path);
		const key = f.path.toLowerCase();
		if (seen.has(key)) throw new ExportError("EXPORT_PATH_COLLISION");
		seen.add(key);
		if (f.bytes.byteLength > exportLimits.entryBytes) throw new ExportError("EXPORT_LIMIT_EXCEEDED");
		total += Buffer.byteLength(f.path) * 2 + 76 + f.bytes.byteLength;
		if (total > exportLimits.archiveBytes) throw new ExportError("EXPORT_LIMIT_EXCEEDED");
	}
	for (const f of files) {
		const parts = f.path.toLowerCase().split("/");
		parts.pop();
		while (parts.length) {
			if (seen.has(parts.join("/"))) throw new ExportError("EXPORT_PATH_COLLISION");
			parts.pop();
		}
	}
	const locals = [], central = [];
	for (const f of files) {
		const name = Buffer.from(f.path), body = Buffer.from(f.bytes), crc = crc32(body), local = Buffer.alloc(30), entry = Buffer.alloc(46);
		local.writeUInt32LE(67324752);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(2048, 6);
		local.writeUInt16LE(33, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(body.length, 18);
		local.writeUInt32LE(body.length, 22);
		local.writeUInt16LE(name.length, 26);
		entry.writeUInt32LE(33639248);
		entry.writeUInt16LE(788, 4);
		entry.writeUInt16LE(20, 6);
		entry.writeUInt16LE(2048, 8);
		entry.writeUInt16LE(33, 14);
		entry.writeUInt32LE(crc, 16);
		entry.writeUInt32LE(body.length, 20);
		entry.writeUInt32LE(body.length, 24);
		entry.writeUInt16LE(name.length, 28);
		entry.writeUInt32LE((f.mode === "100755" ? 33261 : 33188) * 65536 >>> 0, 38);
		entry.writeUInt32LE(offset, 42);
		locals.push(local, name, body);
		central.push(entry, name);
		offset += local.length + name.length + body.length;
	}
	const directory = Buffer.concat(central), end = Buffer.alloc(22);
	end.writeUInt32LE(101010256);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(directory.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([
		...locals,
		directory,
		end
	], total);
}
//#endregion
//#region src/release-export.ts
const hash = (b) => createHash("sha256").update(b).digest("hex");
var ReleaseExporter = class {
	content;
	sources;
	#inflight = /* @__PURE__ */ new Map();
	constructor(content, sources) {
		this.content = content;
		this.sources = sources;
	}
	advance(principalId, exportId, signal = new AbortController().signal) {
		const key = principalId + "\0" + exportId, old = this.#inflight.get(key);
		if (old) return old;
		if (this.#inflight.size >= 2) return Promise.reject(new ExportError("EXPORT_PACK_CAPACITY"));
		const work = this.pack(principalId, exportId, signal).finally(() => this.#inflight.delete(key));
		this.#inflight.set(key, work);
		return work;
	}
	async pack(principalId, exportId, signal) {
		const storage = this.content.storage, context = await storage.request("claimReleaseExport", {
			principalId,
			exportId
		});
		if (!context) return storage.request("getReleaseExport", {
			principalId,
			exportId
		});
		const claim = {
			principalId,
			exportId,
			generation: context.generation,
			claimToken: context.claimToken
		}, s = context.snapshot;
		try {
			const files = [], items = [];
			let total = 0;
			const add = (path, bytes, originalSha256 = null, transform = "EXACT", mode = "100644") => {
				total += bytes.byteLength;
				if (total > 190 * 1024 * 1024 || bytes.byteLength > exportLimits.entryBytes) throw new ExportError("EXPORT_LIMIT_EXCEEDED");
				files.push({
					path,
					bytes,
					mode
				});
				items.push({
					path,
					sha256: hash(bytes),
					byteSize: bytes.byteLength,
					originalSha256,
					transform
				});
			};
			const source = await this.sources.read(context, signal);
			if (source.length !== s.source.manifest.files.length) throw new ExportError("EXPORT_SOURCE_CHANGED");
			const found = /* @__PURE__ */ new Set();
			for (const f of source) {
				signal.throwIfAborted();
				const original = s.source.manifest.files.find((e) => e.path === f.path);
				if (found.has(f.path) || !original || original.mode !== f.mode || original.byteSize !== f.bytes.byteLength || original.sha256 !== hash(f.bytes)) throw new ExportError("EXPORT_SOURCE_CHANGED");
				found.add(f.path);
				add("source/" + f.path, f.bytes, original.sha256, "EXACT", f.mode);
			}
			for (const m of s.materials) {
				signal.throwIfAborted();
				await storage.request("getReleaseExportContext", claim);
				const bytes = await this.content.readBytes(principalId, {
					kind: "exportMaterial",
					exportId,
					materialKey: m.key,
					generation: claim.generation,
					claimToken: claim.claimToken
				}, exportLimits.entryBytes);
				if (bytes.byteLength !== m.byteSize || hash(bytes) !== m.contentHash) throw new ExportError("EXPORT_MATERIAL_CHANGED");
				let output = bytes;
				if (m.transform === "REDACT_JSON") {
					let text;
					try {
						text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
					} catch {
						throw new ExportError("EXPORT_RECORD_INVALID");
					}
					let value;
					try {
						value = JSON.parse(text);
					} catch {
						value = text;
					}
					output = Buffer.from(canonical$1(redactExportRecord(value)));
				}
				add(m.path, output, m.contentHash, m.transform);
			}
			add("records.json", Buffer.from(canonical$1(s.records)), null, "PLATFORM_PROJECTION");
			const manifest = {
				schemaVersion: "devmesh.release-export.v1",
				scope: "ACCEPTED_RELEASE_DELIVERY",
				completeness: "COMPLETE_WITHIN_SCOPE",
				releaseId: s.release.releaseId,
				projectId: s.release.projectId,
				runId: s.release.runId,
				candidateId: s.candidateId,
				candidateRevision: s.candidateRevision,
				manifestHash: s.manifestHash,
				codeCommit: s.codeCommit,
				requirementRevision: s.requirementRevision,
				planRevision: s.planRevision,
				checkConfigHash: s.checkConfigHash,
				templateVersion: s.templateVersion,
				cutoffSeq: s.cutoffSeq,
				snapshotHash: context.job.snapshotHash,
				acceptedAt: s.release.acceptedAt,
				missing: [],
				excluded: [
					"business-dataset",
					"platform-credentials-and-runtime-authority",
					"model-request-response-and-private-reasoning"
				],
				contentPolicy: "Project source/build/image bytes are exact approved deliverables; platform records are projected and redacted. This is not a platform restore archive or an arbitrary project secret scanner.",
				entryCount: items.length,
				files: items.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
			};
			const body = Buffer.from(canonical$1(manifest));
			if (body.length > 192 * 1024) throw new ExportError("EXPORT_LIMIT_EXCEEDED");
			files.push({
				path: "manifest.json",
				bytes: body
			});
			const archive = buildExportZip(files);
			await storage.request("prepareReleaseExportArchive", {
				...claim,
				hash: hash(archive),
				byteSize: archive.length,
				manifest
			});
			await this.content.putBytes({
				principalId,
				scopeId: exportId,
				idempotencyKey: context.writeKey
			}, {
				kind: "releaseExport",
				exportId,
				generation: claim.generation,
				claimToken: claim.claimToken
			}, archive, "application/zip");
			return await storage.request("getReleaseExport", {
				principalId,
				exportId
			});
		} catch (error) {
			const original = await storage.request("getReleaseExport", {
				principalId,
				exportId
			});
			if (original.state === "READY") return original;
			const cause = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "";
			const code = /^EXPORT_[A-Z_]+$/.test(cause) ? cause : ["CONTENT_MISSING", "CONTENT_UNAVAILABLE"].includes(cause) ? "EXPORT_MATERIAL_MISSING" : cause === "CONTENT_CORRUPT" ? "EXPORT_MATERIAL_CHANGED" : signal.aborted ? "EXPORT_INTERRUPTED" : "EXPORT_PACK_FAILED";
			try {
				return await storage.request("failReleaseExport", {
					...claim,
					errorCode: code
				});
			} catch {
				throw error;
			}
		}
	}
};
//#endregion
export { CandidateFreezer, DeliveryCollector, QualityCollector, ReleaseExporter, RepairPlanner, VerificationError, WorkVerifier, assertQualityScope, buildExportZip, canonical, evaluateQuality, exportLimits, exportPath, freezeQualitySourceScope, normalizeReportPath, parseIstanbulReport, parseReportJson, parseVitestReport, previewImageLimits, qualityPolicyHash, sha256, verifyPreviewImage };

//# sourceMappingURL=index.mjs.map