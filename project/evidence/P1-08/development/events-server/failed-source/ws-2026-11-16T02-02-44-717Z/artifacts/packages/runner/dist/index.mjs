import { a as jobSchema, c as resourceLimits, i as imageDigest, l as startJob, n as attemptKey, o as ownerKey, r as commandSpec, s as renewJob, t as RunnerError } from "./protocol-CrzCRB9P.mjs";
import { i as workspaceFenceSchema, n as releaseWorkspaceFence, t as acquireWorkspaceFence } from "./workspace-fence-BX3LCM3x.mjs";
import { a as RunnerStore, i as RunnerMaterials, n as openRunnerStorage, o as openRunnerStore, r as RunnerManager, s as RunnerPolicy, t as serveRunner } from "./server-ke1TSt2G.mjs";
import { i as RunnerDatasetPaths, t as LocalSqliteDatasetBackend } from "./dataset-backend-qZrMml_D.mjs";
import { d as webCrudDatasetProfile, i as datasetHash } from "./dataset-journal-BxtC082T.mjs";
import { i as validateAcceptanceFences, r as validateAcceptanceDataset, t as LocalSqliteAcceptanceDatasetBackend } from "./acceptance-dataset-backend-lXOInqKH.mjs";
import { C as releaseRetirementActionRequest, E as releaseRetirementRevocation, F as acceptanceServiceRequest, G as previewRepository, H as previewContainerNames, I as acceptanceServiceReservation, K as previewReservationSchema, M as acceptanceServiceFact, N as acceptanceServiceNames, P as acceptanceServiceProfile, R as dockerObjectId, T as releaseRetirementRequest, W as previewContainerProfile, Y as runnerCapacity, _ as runnerPreviewLifecycle, a as releaseServiceGateBinding, b as acceptanceAbortObservation, c as releaseServiceProfile, g as previewReleaseClaim, h as previewCleanupRequest, i as releaseServiceFences, l as releaseServiceRequest, m as previewCleanupObservation, o as releaseServiceGuardProof, p as previewCleanupKind, q as previewResourceLimits, r as releaseServiceFact, s as releaseServiceNames, w as releaseRetirementObservation, y as acceptanceAbortActionRequest } from "./release-service-CQfgXb3J.mjs";
import { a as acceptanceDatasetAbortReceipt, i as acceptanceDatasetAbortProof, o as acceptanceDatasetAbortRequest, r as acceptanceDatasetAbortJournal, t as RunnerAcceptanceDatasetAbortBackend } from "./acceptance-dataset-abort-backend-Q7Q5JM8t.mjs";
import { z } from "zod";
import { ids, opaqueKey, sha256 } from "@devmesh/contracts";
import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { acceptanceAbortCompletionEvidence, acceptanceAbortDecision, acceptancePreparationObservation, canonical, previewAccessHttpRequest, previewRuntimeFact, previewStartRequest, previewStopRequest, releaseAccessHttpRequest, releaseAccessRequestHash, releaseAccessTarget, releasePublicationObservation, releaseTargetForPublication } from "@devmesh/storage-sqlite";
import { spawn } from "node:child_process";
import { request } from "node:http";
//#region src/client.ts
var RunnerClient = class {
	credentialRef;
	credentials;
	timeoutMs;
	base;
	constructor(endpoint, credentialRef, credentials, timeoutMs = 1e4) {
		this.credentialRef = credentialRef;
		this.credentials = credentials;
		this.timeoutMs = timeoutMs;
		const u = new URL(endpoint);
		if (u.username || u.password || u.search || u.hash || !["http:", "https:"].includes(u.protocol) || u.protocol === "http:" && ![
			"localhost",
			"127.0.0.1",
			"[::1]"
		].includes(u.hostname)) throw new RunnerError("RUNNER_ENDPOINT_INVALID", 422, "not-sent");
		if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 3e4) throw new RunnerError("RUNNER_TIMEOUT_INVALID", 422, "not-sent");
		this.base = new URL(u.href.replace(/\/$/, "") + "/runner/v1/");
	}
	async request(method, path, body) {
		let key;
		try {
			key = await this.credentials(this.credentialRef);
		} catch {
			throw new RunnerError("RUNNER_AUTH_UNAVAILABLE", 503, "not-sent");
		}
		if (!key || key.length < 16) throw new RunnerError("RUNNER_NOT_CONFIGURED", 503, "not-sent");
		const controller = new AbortController(), timer = setTimeout(() => controller.abort(), this.timeoutMs);
		timer.unref();
		try {
			const r = await fetch(new URL(path, this.base), {
				method,
				headers: {
					Authorization: "Bearer " + key,
					"Content-Type": "application/json"
				},
				...body === void 0 ? {} : { body: JSON.stringify(body) },
				redirect: "error",
				signal: controller.signal
			});
			if (!r.ok) {
				await r.body?.cancel();
				throw new RunnerError(r.status === 404 ? "JOB_NOT_FOUND" : r.status === 401 || r.status === 403 ? "RUNNER_FORBIDDEN" : r.status === 409 ? "RUNNER_CONFLICT" : "RUNNER_UNAVAILABLE", r.status, r.status >= 500 ? "unknown" : "known");
			}
			if (!r.body) throw new RunnerError("RUNNER_RESPONSE_INVALID", 502, "unknown");
			const chunks = [];
			let size = 0;
			const reader = r.body.getReader();
			try {
				for (;;) {
					const result = await reader.read();
					if (result.done) break;
					size += result.value.length;
					if (size > 256 * 1024) throw new RunnerError("RUNNER_RESPONSE_TOO_LARGE", 502, "unknown");
					chunks.push(result.value);
				}
			} finally {
				await reader.cancel();
			}
			try {
				return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
			} catch {
				throw new RunnerError("RUNNER_RESPONSE_INVALID", 502, "unknown");
			}
		} catch (error) {
			if (error instanceof RunnerError) throw error;
			throw new RunnerError("RUNNER_TRANSPORT_UNKNOWN", 503, "unknown");
		} finally {
			clearTimeout(timer);
		}
	}
	async start(input) {
		return this.decode(await this.request("POST", "jobs", startJob.parse(input)));
	}
	async get(jobId) {
		return this.decode(await this.request("GET", "jobs/" + encodeURIComponent(jobId)));
	}
	async byOperation(operationId) {
		return this.decode(await this.request("GET", "jobs/by-operation/" + encodeURIComponent(operationId)));
	}
	async stop(jobId) {
		return this.decode(await this.request("POST", "jobs/" + encodeURIComponent(jobId) + ":stop", {}));
	}
	async renew(jobId, input) {
		return this.decode(await this.request("POST", "jobs/" + encodeURIComponent(jobId) + ":renew", renewJob.parse(input)));
	}
	decodeFence(value) {
		const result = workspaceFenceSchema.safeParse(value);
		if (!result.success) throw new RunnerError("RUNNER_RESPONSE_INVALID", 502, "unknown");
		return result.data;
	}
	async acquireWorkspaceFence(input) {
		return this.decodeFence(await this.request("POST", "workspace-fences", acquireWorkspaceFence.parse(input)));
	}
	async getWorkspaceFence(fenceId) {
		return this.decodeFence(await this.request("GET", "workspace-fences/" + encodeURIComponent(fenceId)));
	}
	async workspaceFenceByOperation(operationId) {
		return this.decodeFence(await this.request("GET", "workspace-fences/by-operation/" + encodeURIComponent(operationId)));
	}
	async activeWorkspaceFence(workspaceRef) {
		return this.decodeFence(await this.request("GET", "workspace-fences/active/" + encodeURIComponent(workspaceRef)));
	}
	async releaseWorkspaceFence(fenceId, input) {
		return this.decodeFence(await this.request("POST", "workspace-fences/" + encodeURIComponent(fenceId) + ":release", releaseWorkspaceFence.parse(input)));
	}
	async logs(jobId, offset = 0, limit = 16384) {
		ids.job.parse(jobId);
		if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 65536) throw new RunnerError("RUNNER_LOG_CURSOR_INVALID", 422, "not-sent");
		const parsed = z.strictObject({
			jobId: ids.job,
			offset: z.number().int().nonnegative(),
			nextOffset: z.number().int().nonnegative(),
			complete: z.boolean(),
			data: z.string().max(87384)
		}).safeParse(await this.request("GET", "jobs/" + encodeURIComponent(jobId) + "/logs?offset=" + offset + "&limit=" + limit));
		if (!parsed.success) throw new RunnerError("RUNNER_RESPONSE_INVALID", 502, "unknown");
		const value = parsed.data, bytes = Buffer.from(value.data, "base64");
		if (value.jobId !== jobId || value.offset !== offset || value.nextOffset !== offset + bytes.byteLength || bytes.byteLength > limit || bytes.toString("base64") !== value.data) throw new RunnerError("RUNNER_RESPONSE_INVALID", 502, "unknown");
		return value;
	}
	/** Read an original output by its recorded index; never accepts a remote path. */
	async output(jobId, index, expected, maximumBytes = 8 * 1024 * 1024) {
		ids.job.parse(jobId);
		if (!Number.isSafeInteger(index) || index < 0 || index > 32 || !Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 64 * 1024 * 1024 || !Number.isSafeInteger(expected.byteSize) || expected.byteSize < 0 || expected.byteSize > maximumBytes || !/^[a-f0-9]{64}$/.test(expected.sha256)) throw new RunnerError("RUNNER_OUTPUT_LIMIT_INVALID", 422, "not-sent");
		let key;
		try {
			key = await this.credentials(this.credentialRef);
		} catch {
			throw new RunnerError("RUNNER_AUTH_UNAVAILABLE", 503, "not-sent");
		}
		if (!key || key.length < 16) throw new RunnerError("RUNNER_NOT_CONFIGURED", 503, "not-sent");
		const controller = new AbortController(), timer = setTimeout(() => controller.abort(), this.timeoutMs);
		timer.unref();
		try {
			const response = await fetch(new URL("jobs/" + encodeURIComponent(jobId) + "/outputs/" + index, this.base), {
				method: "GET",
				headers: { Authorization: "Bearer " + key },
				redirect: "error",
				signal: controller.signal
			});
			if (!response.ok) {
				await response.body?.cancel();
				throw new RunnerError(response.status === 404 ? "RUNNER_OUTPUT_NOT_FOUND" : response.status === 401 || response.status === 403 ? "RUNNER_FORBIDDEN" : "RUNNER_UNAVAILABLE", response.status, response.status >= 500 ? "unknown" : "known");
			}
			if (!response.body) throw new RunnerError("RUNNER_RESPONSE_INVALID", 502, "unknown");
			const reader = response.body.getReader(), chunks = [], hash = createHash("sha256");
			let size = 0;
			try {
				if (response.headers.get("X-Content-SHA256") !== expected.sha256) throw new RunnerError("RUNNER_OUTPUT_CORRUPT", 502, "known");
				const length = response.headers.get("Content-Length");
				if (length !== null && length !== String(expected.byteSize)) throw new RunnerError("RUNNER_OUTPUT_CORRUPT", 502, "known");
				for (;;) {
					const part = await reader.read();
					if (part.done) break;
					size += part.value.byteLength;
					if (size > expected.byteSize || size > maximumBytes) throw new RunnerError("RUNNER_OUTPUT_TOO_LARGE", 502, "known");
					hash.update(part.value);
					chunks.push(part.value);
				}
				if (size !== expected.byteSize || hash.digest("hex") !== expected.sha256) throw new RunnerError("RUNNER_OUTPUT_CORRUPT", 502, "known");
				return Buffer.concat(chunks, size);
			} finally {
				await reader.cancel();
			}
		} catch (error) {
			if (error instanceof RunnerError) throw error;
			throw new RunnerError("RUNNER_TRANSPORT_UNKNOWN", 503, "unknown");
		} finally {
			clearTimeout(timer);
		}
	}
	decode(value) {
		const result = jobSchema.safeParse(value);
		if (!result.success) throw new RunnerError("RUNNER_RESPONSE_INVALID", 502, "unknown");
		return result.data;
	}
};
//#endregion
//#region src/docker.ts
const inspectSchema = z.array(z.object({
	Id: z.string().min(1),
	Config: z.object({ Labels: z.record(z.string(), z.string()).nullable() }),
	State: z.object({
		Status: z.string(),
		Running: z.boolean(),
		Pid: z.number().int().nonnegative(),
		ExitCode: z.number().int(),
		StartedAt: z.string(),
		FinishedAt: z.string()
	})
})).length(1);
var DockerBackend = class {
	configured;
	#options;
	#execute;
	constructor(options, executor) {
		this.#options = { ...options };
		if (!isAbsolute(options.dockerPath) || !options.socketPath.startsWith("/") || !Number.isSafeInteger(options.workspaceBytes) || options.workspaceBytes < 1048576 || options.workspaceBytes > 10 * 1024 ** 3) throw new RunnerError("RUNNER_DOCKER_CONFIG_INVALID", 422);
		this.configured = options.enabled === true && !!options.quota && process.platform === "linux";
		this.#execute = executor ?? ((args, timeoutMs, maximumBytes) => new Promise((resolve, reject) => {
			const child = spawn(options.dockerPath, [
				"--host",
				"unix://" + options.socketPath,
				...args
			], {
				shell: false,
				windowsHide: true,
				stdio: [
					"ignore",
					"pipe",
					"pipe"
				],
				env: {
					PATH: "/usr/local/bin:/usr/bin:/bin",
					LANG: "C.UTF-8"
				}
			});
			let bytes = 0;
			const chunks = [];
			const timer = setTimeout(() => {
				child.kill("SIGKILL");
				reject(new RunnerError("RUNNER_DOCKER_UNKNOWN", 503, "unknown"));
			}, timeoutMs);
			timer.unref();
			const collect = (chunk) => {
				bytes += chunk.length;
				if (bytes > maximumBytes) {
					child.kill("SIGKILL");
					reject(new RunnerError("RUNNER_DOCKER_OUTPUT_LIMIT", 503, "unknown"));
				} else chunks.push(chunk);
			};
			child.stdout.on("data", collect);
			if (args[0] === "logs") child.stderr.on("data", collect);
			else child.stderr.resume();
			child.once("error", () => {
				clearTimeout(timer);
				reject(new RunnerError("RUNNER_DOCKER_UNAVAILABLE", 503, "unknown"));
			});
			child.once("close", (code) => {
				clearTimeout(timer);
				resolve({
					code: code ?? -1,
					stdout: Buffer.concat(chunks).toString("utf8")
				});
			});
		}));
	}
	enabled() {
		if (!this.configured) throw new RunnerError("RUNNER_NOT_CONFIGURED", 503, "not-sent");
	}
	async call(args, timeout = 15e3, maximumBytes = 1024 * 1024) {
		const r = await this.#execute(args, timeout, maximumBytes);
		if (r.code !== 0) throw new RunnerError("RUNNER_DOCKER_UNKNOWN", 503, "unknown");
		return r.stdout;
	}
	async probe() {
		this.enabled();
		const result = z.object({
			OSType: z.literal("linux"),
			Runtimes: z.record(z.string(), z.unknown())
		}).parse(JSON.parse(await this.call([
			"info",
			"--format",
			"{{json .}}"
		])));
		if (!Object.hasOwn(result.Runtimes, "runsc")) throw new RunnerError("RUNNER_RUNSC_UNAVAILABLE", 503, "not-sent");
	}
	createArguments(job, workspacePath, argv) {
		if (!isAbsolute(workspacePath) || [
			"\0",
			"\r",
			"\n",
			","
		].some((c) => workspacePath.includes(c)) || !argv.length || argv.some((a) => a.includes("\0"))) throw new RunnerError("RUNNER_COMMAND_DENIED", 403);
		const l = job.request.resourceLimits;
		return [
			"create",
			"--name",
			"devmesh-" + job.jobId,
			"--label",
			"devmesh.runner=" + this.#options.runnerId,
			"--label",
			"devmesh.job=" + job.jobId,
			"--label",
			"devmesh.request=" + job.requestHash,
			"--runtime=runsc",
			"--network=none",
			"--user=10001:10001",
			"--read-only",
			"--cap-drop=ALL",
			"--security-opt=no-new-privileges:true",
			"--pids-limit=" + l.pids,
			"--cpus=" + l.cpu,
			"--memory=" + l.memoryMiB + "m",
			"--memory-swap=" + l.memoryMiB + "m",
			"--ulimit",
			"nofile=1024:1024",
			"--tmpfs",
			"/tmp:rw,noexec,nosuid,nodev,size=" + l.temporaryMiB + "m,mode=1777",
			"--mount",
			"type=bind,src=" + workspacePath + ",dst=/workspace",
			"--workdir=/workspace",
			"--log-driver=local",
			"--log-opt=max-size=10m",
			"--log-opt=max-file=2",
			"--env",
			"HOME=/tmp",
			"--env",
			"CI=true",
			"--entrypoint=" + argv[0],
			job.request.imageDigest,
			...argv.slice(1)
		];
	}
	verify(job, fact) {
		if (fact.labels["devmesh.runner"] !== this.#options.runnerId || fact.labels["devmesh.job"] !== job.jobId || fact.labels["devmesh.request"] !== job.requestHash || job.containerId !== null && job.containerId !== fact.containerId) throw new RunnerError("RUNNER_CONTAINER_IDENTITY_MISMATCH", 409);
		return fact;
	}
	async start(job, workspacePath, argv, authorize) {
		this.enabled();
		await this.#options.quota.enforce(workspacePath, this.#options.workspaceBytes);
		if (!z.array(z.string()).parse(JSON.parse(await this.call([
			"image",
			"inspect",
			"--format",
			"{{json .RepoDigests}}",
			job.request.imageDigest
		]))).includes(job.request.imageDigest)) throw new RunnerError("RUNNER_IMAGE_UNAVAILABLE", 503, "not-sent");
		if (!await authorize()) throw new RunnerError("RUNNER_LEASE_REVOKED", 403, "not-sent");
		await this.call(this.createArguments(job, workspacePath, argv));
		if (!await authorize()) throw new RunnerError("RUNNER_LEASE_REVOKED", 403, "unknown");
		await this.call(["start", "devmesh-" + job.jobId]);
		const fact = await this.inspect(job);
		if (!fact) throw new RunnerError("RUNNER_DOCKER_UNKNOWN", 503, "unknown");
		return fact;
	}
	async inspect(job) {
		this.enabled();
		const r = await this.#execute([
			"inspect",
			"--type",
			"container",
			"devmesh-" + job.jobId
		], 15e3, 128 * 1024);
		if (r.code !== 0) return null;
		const data = inspectSchema.parse(JSON.parse(r.stdout))[0];
		const s = data.State, state = s.Running ? "running" : s.Status === "exited" && s.Pid === 0 ? "exited" : s.Status === "created" && s.Pid === 0 ? "created" : "unknown";
		return this.verify(job, {
			containerId: data.Id,
			state,
			pid: s.Pid,
			exitCode: state === "exited" ? s.ExitCode : null,
			startedAt: s.StartedAt,
			finishedAt: s.FinishedAt,
			labels: data.Config.Labels ?? {}
		});
	}
	async stop(job) {
		this.enabled();
		const before = await this.inspect(job);
		if (before?.state === "exited") return before;
		if (before?.state === "running") await this.#execute([
			"stop",
			"--signal=SIGTERM",
			"--timeout=10",
			"devmesh-" + job.jobId
		], 15e3, 4096);
		return this.inspect(job);
	}
	async logs(job) {
		this.enabled();
		if (!await this.inspect(job)) throw new RunnerError("RUNNER_DOCKER_UNKNOWN", 503, "unknown");
		const value = await this.call([
			"logs",
			"--timestamps",
			"--tail",
			"10000",
			"devmesh-" + job.jobId
		], 15e3, 1024 * 1024);
		return new TextEncoder().encode(value);
	}
};
//#endregion
//#region src/service-docker.ts
const fail$1 = (code) => {
	throw new RunnerError(code, 409, "unknown");
};
function serviceDockerRemovalArguments(kind, id) {
	dockerObjectId.parse(id);
	return kind === "CONTAINER_REMOVE" ? [
		"container",
		"rm",
		id
	] : [
		"network",
		"rm",
		id
	];
}
/** A failed inspect is insufficient; only a successful full-ID list proves absence. */
function verifyServiceDockerAbsence(output, id, errorCode) {
	dockerObjectId.parse(id);
	const value = output.trim();
	if (value === "") return true;
	if (value === id) return false;
	throw new RunnerError(errorCode, 409, "unknown");
}
const labels$1 = (_p, r) => r.labels;
const environment = (r) => [
	"HOME=/tmp",
	"NODE_ENV=production",
	"APP_DATA_ROOT=/data",
	"APP_PORT=4317",
	"APP_HOST=0.0.0.0",
	"APP_READ_ONLY=" + String(r.readonlyDataset),
	...r.runtimeRoot ? ["APP_RUNTIME_ROOT=" + r.runtimeRoot] : []
];
const expectedMounts = (p, r) => [{
	Source: p.datasetDirectory,
	Destination: "/data",
	RW: !r.readonlyDataset
}, ...r.readonlyDataset ? [] : [
	"operation.json",
	"receipt.json",
	"dataset.json"
].map((name) => ({
	Source: join(p.datasetDirectory, name),
	Destination: "/data/" + name,
	RW: false
}))];
const tmpfs = (p) => "rw,noexec,nosuid,nodev,size=" + p.resourceLimits.temporaryMiB + "m,mode=1777";
function serviceDockerNetworkArguments(raw, r) {
	const p = raw;
	return [
		"network",
		"create",
		"--driver=bridge",
		"--internal",
		"--opt=com.docker.network.bridge.enable_icc=false",
		"--opt=com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
		"--opt=com.docker.network.bridge.gateway_mode_ipv4=nat",
		...Object.entries(labels$1(p, r)).flatMap(([k, v]) => ["--label", k + "=" + v]),
		p.networkName
	];
}
function serviceDockerCreateArguments(raw, r, networkId) {
	const p = raw;
	dockerObjectId.parse(networkId);
	const l = p.resourceLimits;
	const mounts = expectedMounts(p, r).map((m) => "type=bind,src=" + m.Source + ",dst=" + m.Destination + (m.RW ? "" : ",readonly"));
	return [
		"create",
		"--name",
		p.containerName,
		...Object.entries(labels$1(p, r)).flatMap(([k, v]) => ["--label", k + "=" + v]),
		"--runtime=runsc",
		"--network=" + networkId,
		"--publish=127.0.0.1::4317/tcp",
		"--user=10001:10001",
		"--read-only",
		"--cap-drop=ALL",
		"--security-opt=no-new-privileges:true",
		"--cgroupns=private",
		"--ipc=private",
		"--restart=no",
		"--pids-limit=" + l.pids,
		"--cpus=" + l.cpu,
		"--memory=" + l.memoryMiB + "m",
		"--memory-swap=" + l.memoryMiB + "m",
		"--ulimit=nofile=1024:1024",
		"--tmpfs=/tmp:" + tmpfs(p),
		...mounts.flatMap((v) => ["--mount", v]),
		"--workdir=/app",
		"--log-driver=local",
		"--log-opt=max-size=10m",
		"--log-opt=max-file=2",
		...environment(r).flatMap((v) => ["--env", v]),
		"--entrypoint=node",
		p.repository + "@" + r.imageDigest,
		"/app/dist/server/main.js",
		"serve"
	];
}
/** Compare exact immutable OCI identities, never equate manifest digest and config ID. */
function verifyServiceDockerImage(value, r, repository) {
	previewRepository.parse(repository);
	const [v] = z.array(z.object({
		Id: z.string(),
		RepoDigests: z.array(z.string()),
		Os: z.string(),
		Architecture: z.string(),
		RootFS: z.object({
			Type: z.string(),
			Layers: z.array(z.string())
		}),
		Config: z.object({ Labels: z.record(z.string(), z.string()).nullable() })
	})).length(1).parse(value), i = r.imageIdentity;
	if (v.Id !== i.configDigest || !v.RepoDigests.includes(repository + "@" + i.imageDigest) || v.Os !== i.os || v.Architecture !== i.architecture || v.RootFS.Type !== "layers" || canonical(v.RootFS.Layers) !== canonical(i.layers.map((l) => l.diffId)) || v.Config.Labels?.["org.opencontainers.image.revision"] !== i.targetCommit || v.Config.Labels?.["io.devmesh.build.sha256"] !== i.buildArtifactHash) fail$1(r.errorPrefix + "_DOCKER_IMAGE_CHANGED");
}
function verifyServiceDockerNetwork(value, p, r) {
	const [n] = z.array(z.object({
		Id: dockerObjectId,
		Name: z.string(),
		Driver: z.string(),
		Internal: z.boolean(),
		Attachable: z.boolean(),
		Ingress: z.boolean(),
		EnableIPv6: z.boolean(),
		Labels: z.record(z.string(), z.string()).nullable(),
		Options: z.record(z.string(), z.string()),
		Containers: z.record(z.string(), z.object({ Name: z.string() }))
	})).length(1).parse(value);
	if (n.Name !== p.networkName || n.Driver !== "bridge" || !n.Internal || n.Attachable || n.Ingress || n.EnableIPv6 || Object.entries(labels$1(p, r)).some(([k, v]) => n.Labels?.[k] !== v) || n.Options["com.docker.network.bridge.enable_icc"] !== "false" || n.Options["com.docker.network.bridge.host_binding_ipv4"] !== "127.0.0.1" || n.Options["com.docker.network.bridge.gateway_mode_ipv4"] !== "nat" || Object.values(n.Containers).length > 1 || Object.entries(n.Containers).some(([id, c]) => !dockerObjectId.safeParse(id).success || c.Name !== p.containerName)) fail$1(r.errorPrefix + "_DOCKER_NETWORK_CHANGED");
	return n.Id;
}
const nilOrEmpty = (v) => v == null || Array.isArray(v) && v.length === 0;
/** Called on every observation, including cleanup; wrong original objects are never stopped. */
function verifyServiceDockerContainer(value, p, r, networkId, containerId) {
	const item = z.object({
		Id: dockerObjectId,
		Name: z.string(),
		Image: z.string(),
		Config: z.object({
			Image: z.string(),
			User: z.string(),
			WorkingDir: z.string(),
			Entrypoint: z.array(z.string()),
			Cmd: z.array(z.string()),
			Env: z.array(z.string()),
			Labels: z.record(z.string(), z.string()).nullable(),
			Tty: z.boolean(),
			OpenStdin: z.boolean()
		}),
		HostConfig: z.object({
			Runtime: z.string(),
			NetworkMode: z.string(),
			ReadonlyRootfs: z.boolean(),
			Privileged: z.boolean(),
			CapAdd: z.unknown(),
			CapDrop: z.array(z.string()),
			SecurityOpt: z.array(z.string()),
			Devices: z.unknown(),
			DeviceRequests: z.unknown(),
			Binds: z.unknown(),
			VolumesFrom: z.unknown(),
			PidMode: z.string(),
			IpcMode: z.string(),
			CgroupnsMode: z.string(),
			Memory: z.number(),
			MemorySwap: z.number(),
			NanoCpus: z.number(),
			PidsLimit: z.number(),
			AutoRemove: z.boolean(),
			RestartPolicy: z.object({
				Name: z.string(),
				MaximumRetryCount: z.number()
			}),
			Tmpfs: z.record(z.string(), z.string()),
			PortBindings: z.record(z.string(), z.array(z.object({
				HostIp: z.string(),
				HostPort: z.string()
			}))),
			LogConfig: z.object({
				Type: z.string(),
				Config: z.record(z.string(), z.string())
			})
		}),
		Mounts: z.array(z.object({
			Type: z.string(),
			Source: z.string(),
			Destination: z.string(),
			RW: z.boolean(),
			Propagation: z.string()
		})),
		State: z.object({
			Status: z.string(),
			Running: z.boolean(),
			Pid: z.number().int().nonnegative(),
			ExitCode: z.number().int(),
			StartedAt: z.string(),
			FinishedAt: z.string()
		}),
		NetworkSettings: z.object({
			Networks: z.record(z.string(), z.object({ NetworkID: z.string() })),
			Ports: z.record(z.string(), z.array(z.object({
				HostIp: z.string(),
				HostPort: z.string()
			})).nullable())
		})
	});
	const d = z.array(item).length(1).parse(value)[0], c = d.Config, h = d.HostConfig, l = p.resourceLimits, s = d.State;
	const mounts = expectedMounts(p, r);
	if (d.Name !== "/" + p.containerName || containerId !== null && d.Id !== containerId || d.Image !== r.imageIdentity.configDigest || c.Image !== p.repository + "@" + r.imageDigest || c.User !== "10001:10001" || c.WorkingDir !== "/app" || canonical(c.Entrypoint) !== canonical(["node"]) || canonical(c.Cmd) !== canonical(["/app/dist/server/main.js", "serve"]) || environment(r).some((v) => c.Env.filter((e) => e.split("=")[0] === v.split("=")[0]).join("") !== v) || c.OpenStdin || c.Tty || Object.entries(labels$1(p, r)).some(([k, v]) => c.Labels?.[k] !== v)) fail$1(r.errorPrefix + "_DOCKER_CONTAINER_CHANGED");
	if (h.Runtime !== "runsc" || h.NetworkMode !== networkId || !h.ReadonlyRootfs || h.Privileged || !nilOrEmpty(h.CapAdd) || canonical(h.CapDrop) !== canonical(["ALL"]) || canonical(h.SecurityOpt) !== canonical(["no-new-privileges:true"]) || !nilOrEmpty(h.Devices) || !nilOrEmpty(h.DeviceRequests) || !nilOrEmpty(h.Binds) || !nilOrEmpty(h.VolumesFrom) || h.PidMode !== "" || h.IpcMode !== "private" || h.CgroupnsMode !== "private" || h.Memory !== l.memoryMiB * 1024 ** 2 || h.MemorySwap !== h.Memory || h.NanoCpus !== l.cpu * 1e9 || h.PidsLimit !== l.pids || h.AutoRemove || h.RestartPolicy.Name !== "no" || h.RestartPolicy.MaximumRetryCount !== 0 || canonical(h.Tmpfs) !== canonical({ "/tmp": tmpfs(p) }) || h.LogConfig.Type !== "local" || canonical(h.LogConfig.Config) !== canonical({
		"max-size": "10m",
		"max-file": "2"
	})) fail$1(r.errorPrefix + "_DOCKER_CONTAINER_CHANGED");
	if (d.Mounts.length !== mounts.length || mounts.some((m) => !d.Mounts.some((a) => a.Type === "bind" && a.Source === m.Source && a.Destination === m.Destination && a.RW === m.RW && a.Propagation === "rprivate"))) fail$1(r.errorPrefix + "_DOCKER_MOUNT_CHANGED");
	const portBindings = h.PortBindings["4317/tcp"];
	if (Object.keys(h.PortBindings).length !== 1 || portBindings?.length !== 1 || portBindings[0].HostIp !== "127.0.0.1") fail$1(r.errorPrefix + "_DOCKER_PORT_CHANGED");
	const networks = Object.entries(d.NetworkSettings.Networks), unstarted = s.Status === "created" && !s.Running && s.Pid === 0 && Date.parse(s.StartedAt) === Date.parse("0001-01-01T00:00:00Z");
	if (networks.length !== 1 || networks[0][0] !== p.networkName || networks[0][1].NetworkID !== networkId && !(unstarted && networks[0][1].NetworkID === "")) fail$1(r.errorPrefix + "_DOCKER_NETWORK_CHANGED");
	let endpoint = null;
	if (s.Running) {
		const ports = d.NetworkSettings.Ports["4317/tcp"], published = ports?.[0] ?? fail$1(r.errorPrefix + "_DOCKER_PORT_CHANGED"), binding = portBindings?.[0] ?? fail$1(r.errorPrefix + "_DOCKER_PORT_CHANGED");
		if (s.Status !== "running" || s.Pid <= 0 || Object.keys(d.NetworkSettings.Ports).length !== 1 || ports?.length !== 1 || published.HostIp !== "127.0.0.1" || !/^\d+$/.test(published.HostPort)) fail$1(r.errorPrefix + "_DOCKER_PORT_CHANGED");
		const port = Number(published.HostPort);
		if (port < 1024 || port > 65535 || binding.HostPort !== "" && binding.HostPort !== String(port)) fail$1(r.errorPrefix + "_DOCKER_PORT_CHANGED");
		endpoint = {
			host: "127.0.0.1",
			port
		};
	}
	const state = s.Running ? "running" : s.Status === "exited" && s.Pid === 0 && Number.isFinite(Date.parse(s.StartedAt)) && Date.parse(s.StartedAt) > 0 && Number.isFinite(Date.parse(s.FinishedAt)) && Date.parse(s.FinishedAt) >= Date.parse(s.StartedAt) ? "exited" : s.Status === "created" && s.Pid === 0 ? "created" : "unknown";
	return {
		containerId: d.Id,
		networkId,
		state,
		pid: s.Pid,
		exitCode: state === "exited" ? s.ExitCode : null,
		endpoint
	};
}
//#endregion
//#region src/acceptance-docker.ts
const hash$7 = (v) => createHash("sha256").update(canonical(v)).digest("hex");
const subject$2 = (p, r) => ({
	imageDigest: r.image.imageDigest,
	imageIdentity: r.image,
	readonlyDataset: true,
	errorPrefix: "ACCEPTANCE_SERVICE",
	labels: p ? {
		"devmesh.runner": r.runnerId,
		"devmesh.purpose": "ACCEPTANCE",
		"devmesh.operation": r.operationId,
		"devmesh.release": r.releaseId,
		"devmesh.dataset": r.target.datasetId,
		"devmesh.reservation": p.reservationId,
		"devmesh.request": p.requestHash,
		"devmesh.profile": hash$7(p)
	} : {}
});
const binding$1 = (raw, input) => {
	const p = acceptanceServiceProfile.parse(raw), r = acceptanceServiceRequest.parse(input);
	if (p.requestHash !== hash$7(r)) throw new RunnerError("ACCEPTANCE_SERVICE_IDENTITY_CHANGED", 409);
	return {
		p,
		r: r.preparation
	};
};
function acceptanceDockerNetworkArguments(raw, input) {
	const { p, r } = binding$1(raw, input);
	return serviceDockerNetworkArguments(p, subject$2(p, r));
}
function acceptanceDockerCreateArguments(raw, input, networkId) {
	const { p, r } = binding$1(raw, input);
	return serviceDockerCreateArguments(p, subject$2(p, r), networkId);
}
function verifyAcceptanceDockerImage(value, r, repository) {
	return verifyServiceDockerImage(value, subject$2(null, r), repository);
}
function verifyAcceptanceDockerNetwork(value, raw, input) {
	const { p, r } = binding$1(raw, input);
	return verifyServiceDockerNetwork(value, p, subject$2(p, r));
}
function verifyAcceptanceDockerContainer(value, raw, input, networkId, containerId) {
	const { p, r } = binding$1(raw, input);
	return verifyServiceDockerContainer(value, p, subject$2(p, r), networkId, containerId);
}
/** Explicit Linux driver. Every physical observation rechecks the full original
* profile; the entire acceptance dataset is mounted read-only. */
var DockerAcceptanceServiceDriver = class {
	configured;
	#execute;
	#options;
	constructor(options, executor) {
		if (!isAbsolute(options.dockerPath) || !options.socketPath.startsWith("/") || /[\0\r\n]/.test(options.socketPath)) throw new RunnerError("ACCEPTANCE_SERVICE_DOCKER_CONFIG_INVALID", 422);
		this.#options = { ...options };
		this.configured = options.enabled === true && process.platform === "linux" && !!options.quota && !!options.networkIsolation;
		this.#execute = executor ?? ((args, timeoutMs, maximumBytes) => new Promise((resolve, reject) => {
			const child = spawn(options.dockerPath, [
				"--host",
				"unix://" + options.socketPath,
				...args
			], {
				shell: false,
				windowsHide: true,
				stdio: [
					"ignore",
					"pipe",
					"ignore"
				],
				env: {
					PATH: "/usr/local/bin:/usr/bin:/bin",
					LANG: "C.UTF-8"
				}
			});
			let count = 0;
			const chunks = [];
			const timer = setTimeout(() => {
				child.kill("SIGKILL");
				reject(new RunnerError("ACCEPTANCE_SERVICE_DOCKER_UNKNOWN", 503, "unknown"));
			}, timeoutMs);
			timer.unref();
			child.stdout.on("data", (b) => {
				count += b.length;
				if (count > maximumBytes) {
					child.kill("SIGKILL");
					reject(new RunnerError("ACCEPTANCE_SERVICE_DOCKER_OUTPUT_LIMIT", 503, "unknown"));
				} else chunks.push(b);
			});
			child.once("error", () => {
				clearTimeout(timer);
				reject(new RunnerError("ACCEPTANCE_SERVICE_DOCKER_UNAVAILABLE", 503, "unknown"));
			});
			child.once("close", (code) => {
				clearTimeout(timer);
				resolve({
					code: code ?? -1,
					stdout: Buffer.concat(chunks).toString("utf8")
				});
			});
		}));
	}
	#enabled() {
		if (!this.configured) throw new RunnerError("ACCEPTANCE_SERVICE_DOCKER_NOT_CONFIGURED", 503, "not-sent");
	}
	async #call(args) {
		this.#enabled();
		const r = await this.#execute(args, 15e3, 256 * 1024);
		if (r.code !== 0) throw new RunnerError("ACCEPTANCE_SERVICE_DOCKER_UNKNOWN", 503, "unknown");
		return r.stdout;
	}
	async probe(r, repository) {
		this.#enabled();
		const info = z.object({
			OSType: z.literal("linux"),
			CgroupVersion: z.literal("2"),
			MemoryLimit: z.literal(true),
			SwapLimit: z.literal(true),
			CpuCfsQuota: z.literal(true),
			PidsLimit: z.literal(true),
			Runtimes: z.record(z.string(), z.unknown())
		}).parse(JSON.parse(await this.#call([
			"info",
			"--format",
			"{{json .}}"
		])));
		if (!Object.hasOwn(info.Runtimes, "runsc")) throw new RunnerError("ACCEPTANCE_SERVICE_RUNSC_UNAVAILABLE", 503, "not-sent");
		verifyAcceptanceDockerImage(JSON.parse(await this.#call([
			"image",
			"inspect",
			repository + "@" + r.image.imageDigest
		])), r, repository);
	}
	async prepare(p) {
		this.#enabled();
		acceptanceServiceProfile.parse(p);
		await this.#options.quota.prepare(p.datasetDirectory, p.datasetBytes);
		if (!await this.#options.quota.verify(p.datasetDirectory, p.datasetBytes)) throw new RunnerError("ACCEPTANCE_SERVICE_QUOTA_UNVERIFIED", 503);
	}
	async network(p, r) {
		this.#enabled();
		binding$1(p, r);
		const out = await this.#execute([
			"network",
			"inspect",
			p.networkName
		], 15e3, 256 * 1024);
		if (out.code !== 0) return null;
		const id = verifyAcceptanceDockerNetwork(JSON.parse(out.stdout), p, r);
		return await this.#options.networkIsolation.verify(id) ? id : null;
	}
	async createNetwork(p, r, authorize) {
		this.#enabled();
		binding$1(p, r);
		if (!await authorize()) throw new RunnerError("ACCEPTANCE_SERVICE_AUTHORITY_REVOKED", 403, "not-sent");
		const id = dockerObjectId.parse((await this.#call(acceptanceDockerNetworkArguments(p, r))).trim());
		await this.#options.networkIsolation.enforce(id);
		if (await this.network(p, r) !== id) throw new RunnerError("ACCEPTANCE_SERVICE_DOCKER_NETWORK_CHANGED", 409);
		return id;
	}
	async inspect(p, r, networkId, containerId) {
		this.#enabled();
		if (await this.network(p, r) !== networkId || !await this.#options.quota.verify(p.datasetDirectory, p.datasetBytes)) throw new RunnerError("ACCEPTANCE_SERVICE_DOCKER_PROFILE_UNVERIFIED", 409);
		const out = await this.#execute([
			"inspect",
			"--type",
			"container",
			p.containerName
		], 15e3, 256 * 1024);
		return out.code === 0 ? verifyAcceptanceDockerContainer(JSON.parse(out.stdout), p, r, networkId, containerId) : null;
	}
	async create(p, r, networkId, authorize) {
		this.#enabled();
		if (!await this.#options.quota.verify(p.datasetDirectory, p.datasetBytes) || await this.network(p, r) !== networkId) throw new RunnerError("ACCEPTANCE_SERVICE_DOCKER_CREATE_UNVERIFIED", 409);
		if (!await authorize()) throw new RunnerError("ACCEPTANCE_SERVICE_AUTHORITY_REVOKED", 403, "not-sent");
		const id = dockerObjectId.parse((await this.#call(acceptanceDockerCreateArguments(p, r, networkId))).trim());
		return this.inspect(p, r, networkId, id);
	}
	async start(p, r, networkId, containerId, authorize) {
		if ((await this.inspect(p, r, networkId, containerId))?.state !== "created") throw new RunnerError("ACCEPTANCE_SERVICE_DOCKER_START_UNVERIFIED", 409);
		if (!await authorize()) throw new RunnerError("ACCEPTANCE_SERVICE_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call(["start", containerId]);
		return this.inspect(p, r, networkId, containerId);
	}
	async stop(p, r, networkId, containerId, authorize) {
		const before = await this.inspect(p, r, networkId, containerId);
		if (before?.state === "created" || before?.state === "exited") return before;
		if (before?.state !== "running") throw new RunnerError("ACCEPTANCE_ABORT_STOP_UNVERIFIED", 409);
		if (!await authorize()) throw new RunnerError("ACCEPTANCE_ABORT_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call([
			"stop",
			"--signal=SIGTERM",
			"--timeout=10",
			containerId
		]);
		return this.inspect(p, r, networkId, containerId);
	}
	async containerAbsent(id) {
		dockerObjectId.parse(id);
		return verifyServiceDockerAbsence(await this.#call([
			"container",
			"ls",
			"--all",
			"--no-trunc",
			"--filter",
			"id=" + id,
			"--format",
			"{{.ID}}"
		]), id, "ACCEPTANCE_ABORT_QUERY_UNVERIFIED");
	}
	async networkAbsent(id) {
		dockerObjectId.parse(id);
		return verifyServiceDockerAbsence(await this.#call([
			"network",
			"ls",
			"--no-trunc",
			"--filter",
			"id=" + id,
			"--format",
			"{{.ID}}"
		]), id, "ACCEPTANCE_ABORT_QUERY_UNVERIFIED");
	}
	async removeContainer(p, r, networkId, containerId, authorize) {
		const before = await this.inspect(p, r, networkId, containerId);
		if (!before || !["created", "exited"].includes(before.state)) throw new RunnerError("ACCEPTANCE_ABORT_CONTAINER_NOT_STOPPED", 409);
		if (!await authorize()) throw new RunnerError("ACCEPTANCE_ABORT_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call(serviceDockerRemovalArguments("CONTAINER_REMOVE", containerId));
	}
	async removeNetwork(p, r, networkId, authorize) {
		const original = JSON.parse(await this.#call([
			"network",
			"inspect",
			networkId
		]));
		if (verifyAcceptanceDockerNetwork(original, p, r) !== networkId || Object.keys(original[0].Containers ?? {}).length) throw new RunnerError("ACCEPTANCE_ABORT_NETWORK_BUSY", 409);
		if (!await authorize()) throw new RunnerError("ACCEPTANCE_ABORT_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call(serviceDockerRemovalArguments("NETWORK_REMOVE", networkId));
	}
};
//#endregion
//#region src/preview-health.ts
/** Only an inspected original container's loopback port may reach this helper. */
async function probePreviewHealth(endpoint, timeoutMs = 2e3) {
	if (endpoint.host !== "127.0.0.1" || !Number.isInteger(endpoint.port) || endpoint.port < 1024 || endpoint.port > 65535 || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 5e3) throw new RunnerError("PREVIEW_HEALTH_TARGET_INVALID", 422);
	return new Promise((resolve) => {
		let settled = false;
		const done = (value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(value);
		};
		const req = request({
			host: "127.0.0.1",
			port: endpoint.port,
			path: "/api/health",
			method: "GET",
			agent: false,
			headers: {
				Accept: "application/json",
				Connection: "close"
			}
		}, (res) => {
			const chunks = [];
			let bytes = 0;
			if (res.statusCode !== 200 || !/^application\/json(?:;|$)/i.test(res.headers["content-type"] ?? "")) {
				done(false);
				res.destroy();
				return;
			}
			res.on("data", (chunk) => {
				bytes += chunk.length;
				if (bytes > 4096) {
					done(false);
					res.destroy();
					req.destroy();
				} else chunks.push(chunk);
			});
			res.on("error", () => done(false));
			res.on("aborted", () => done(false));
			res.on("end", () => {
				try {
					const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
					done(typeof body === "object" && body !== null && !Array.isArray(body) && Object.keys(body).length === 1 && "status" in body && body.status === "ready");
				} catch {
					done(false);
				}
			});
		});
		const timer = setTimeout(() => {
			done(false);
			req.destroy();
		}, timeoutMs);
		req.on("error", () => done(false));
		req.end();
	});
}
//#endregion
//#region src/acceptance-preparation-backend.ts
const optionsSchema$5 = z.strictObject({
	enabled: z.boolean().default(false),
	runnerId: opaqueKey,
	controllerId: opaqueKey,
	backendRef: opaqueKey,
	repository: previewRepository,
	capacity: runnerCapacity,
	resourceLimits: previewResourceLimits,
	datasetBytes: z.number().int().min(4096).max(256 * 1024 * 1024).default(64 * 1024 * 1024)
});
const hash$6 = (v) => createHash("sha256").update(canonical(v)).digest("hex");
const bound$1 = (r) => ({
	controllerId: r.controllerId,
	reservationId: r.reservationId,
	requestHash: r.requestHash
});
/** Explicit trusted composition. Infrastructure adapters are never inferred from
* a client receipt or installed by platform startup. */
var RunnerAcceptancePreparationBackend = class {
	store;
	paths;
	datasets;
	driver;
	options;
	constructor(store, paths, datasets, driver, options) {
		this.store = store;
		this.paths = paths;
		this.datasets = datasets;
		this.driver = driver;
		this.options = optionsSchema$5.parse(options);
		if (this.options.runnerId !== store.options.runnerId || paths.options.runnerId !== this.options.runnerId || datasets.options.runnerId !== this.options.runnerId || datasets.options.backendRef !== this.options.backendRef || new RunnerDatasetPaths(datasets.options).root !== paths.root) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
	}
	get configured() {
		return this.options.enabled && this.driver.configured && this.datasets.configured;
	}
	#enabled(p) {
		if (!this.configured) throw new RunnerError("ACCEPTANCE_RUNNER_NOT_CONFIGURED", 503, "not-sent");
		validateAcceptanceDataset(p, this.datasets.options);
	}
	#unknown(errorCode = "ACCEPTANCE_ORIGINAL_UNVERIFIED") {
		return {
			state: "UNKNOWN",
			errorCode,
			checkedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	}
	async preflight(p) {
		this.#enabled(p);
		await this.datasets.preflight(p);
		await this.store.request("capacityConfigure", this.options.capacity);
		await this.driver.probe(p.request, this.options.repository);
	}
	async #request(p, receipt) {
		const fences = validateAcceptanceFences(await this.datasets.authority.inspect(p), p);
		return acceptanceServiceRequest.parse({
			schemaVersion: "devmesh.acceptance-service-start.v1",
			purpose: "ACCEPTANCE",
			preparation: p.request,
			acceptanceRequestHash: p.requestHash,
			dataReceipt: receipt,
			fences
		});
	}
	async #authorized(p, r, authorize) {
		if (!await authorize()) return false;
		return canonical(validateAcceptanceFences(await this.datasets.authority.inspect(p), p)) === canonical(r.fences) && await authorize();
	}
	#profile(r) {
		return acceptanceServiceProfile.parse({
			schemaVersion: "devmesh.acceptance-service-profile.v1",
			purpose: "ACCEPTANCE",
			accessMode: "READ_ONLY",
			reservationId: r.reservationId,
			requestHash: r.requestHash,
			repository: this.options.repository,
			datasetDirectory: this.paths.resolve({
				projectId: r.request.preparation.projectId,
				datasetId: r.request.preparation.target.datasetId
			}).directory,
			datasetBytes: this.options.datasetBytes,
			resourceLimits: r.resourceLimits,
			...acceptanceServiceNames(r.reservationId)
		});
	}
	#journal(r, j) {
		const p = acceptanceServiceProfile.parse(j.profile), names = acceptanceServiceNames(r.reservationId);
		if (hash$6(p) !== j.profileHash || p.requestHash !== r.requestHash || p.reservationId !== r.reservationId || canonical(p.resourceLimits) !== canonical(r.resourceLimits) || p.datasetDirectory !== this.paths.resolve({
			projectId: r.request.preparation.projectId,
			datasetId: r.request.preparation.target.datasetId
		}).directory || p.networkName !== names.networkName || p.containerName !== names.containerName) throw new RunnerError("ACCEPTANCE_SERVICE_PROFILE_CHANGED", 409);
	}
	async #observe(r, j, kind, fact) {
		const action = j.actions.find((a) => a.request.kind === kind);
		if (!action || action.state === "OBSERVED") return j;
		const state = typeof fact === "string" ? "CREATED" : fact.state === "created" ? "CREATED" : fact.state === "running" ? "RUNNING" : fact.state === "exited" ? "EXITED" : null;
		if (!state || kind === "CREATE" && state !== "CREATED" || kind === "START" && state === "CREATED") return j;
		return this.store.request("acceptanceServiceActionObserve", {
			...bound$1(r),
			kind,
			actionRequestHash: action.requestHash,
			observation: {
				objectId: typeof fact === "string" ? fact : fact.containerId,
				state,
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			}
		});
	}
	async inspect(p) {
		this.#enabled(p);
		const data = await this.datasets.inspect(p);
		if (data.state !== "MATERIALIZED") return this.#unknown(data.errorCode);
		const request = await this.#request(p, data.receipt);
		let r = await this.store.request("acceptanceServiceByOperation", {
			controllerId: this.options.controllerId,
			operationId: p.operationId
		});
		if (!r) return this.#unknown();
		if (r.requestHash !== hash$6(request) || canonical(r.request) !== canonical(request)) throw new RunnerError("ACCEPTANCE_SERVICE_IDENTITY_CHANGED", 409);
		if (r.releasedAt !== null || r.state === "RESERVED") return this.#unknown("ACCEPTANCE_SERVICE_NOT_RUNNING");
		let j = await this.store.request("acceptanceServiceJournal", bound$1(r));
		if (!j) return this.#unknown();
		this.#journal(r, j);
		if (!j.actions.some((a) => a.request.kind === "NETWORK_CREATE")) return this.#unknown();
		const networkId = await this.driver.network(j.profile, request);
		if (!networkId) return this.#unknown();
		if (j.networkId !== null && j.networkId !== networkId) throw new RunnerError("ACCEPTANCE_SERVICE_IDENTITY_CHANGED", 409);
		j = await this.#observe(r, j, "NETWORK_CREATE", networkId);
		if (!j.networkId || !j.actions.some((a) => a.request.kind === "CREATE")) return this.#unknown();
		const f = await this.driver.inspect(j.profile, request, j.networkId, j.containerId);
		if (!f) return this.#unknown();
		j = await this.#observe(r, j, "CREATE", f);
		if (j.containerId !== f.containerId) throw new RunnerError("ACCEPTANCE_SERVICE_IDENTITY_CHANGED", 409);
		j = await this.#observe(r, j, "START", f);
		const healthy = f.state === "running" && f.endpoint ? await probePreviewHealth(f.endpoint) : false;
		const fact = {
			operationId: p.operationId,
			releaseId: p.releaseId,
			datasetId: p.request.target.datasetId,
			imageDigest: p.request.image.imageDigest,
			state: f.state === "running" ? healthy ? "HEALTHY" : "UNHEALTHY" : f.state === "created" ? "CREATED" : f.state === "exited" ? "EXITED" : "UNKNOWN",
			instanceId: f.state === "unknown" ? null : f.containerId,
			endpoint: f.state === "running" ? f.endpoint : null,
			checkedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		r = await this.store.request("acceptanceServiceRecord", {
			...bound$1(r),
			expectedRevision: r.revision,
			fact
		});
		if (fact.state !== "HEALTHY" || !fact.endpoint || !fact.instanceId) return this.#unknown("ACCEPTANCE_SERVICE_UNHEALTHY");
		if (!await this.#authorized(p, request, async () => true)) return this.#unknown("ACCEPTANCE_DATA_CUSTODY_CHANGED");
		const q = p.request, claim = {
			schemaVersion: "devmesh.acceptance-service-claim.v1",
			purpose: "ACCEPTANCE",
			operationId: q.operationId,
			acceptanceRequestHash: p.requestHash,
			releaseId: q.releaseId,
			projectId: q.projectId,
			runId: q.runId,
			candidateId: q.candidateId,
			manifestHash: q.manifestHash,
			reviewHash: q.reviewHash,
			dataPlanHash: q.dataPlanHash,
			datasetId: q.target.datasetId,
			imageDigest: q.image.imageDigest,
			reservationId: r.reservationId,
			profileHash: j.profileHash,
			serviceRequestHash: r.requestHash,
			instanceId: fact.instanceId
		};
		r = await this.store.request("acceptanceServiceHold", {
			...bound$1(r),
			claim,
			claimHash: hash$6(claim)
		});
		const proof = await this.store.request("acceptanceServicePrepareProof", bound$1(r));
		return acceptancePreparationObservation.parse({
			state: "READY",
			proof,
			fences: {
				sourceProofHash: request.fences.sourceFence?.physical.proofHash ?? null,
				targetProofHash: request.fences.targetFence.physical.proofHash,
				state: "HELD",
				writeState: "CLOSED"
			},
			health: {
				instanceId: fact.instanceId,
				datasetId: q.target.datasetId,
				imageDigest: q.image.imageDigest,
				endpoint: fact.endpoint,
				claimHash: r.claimHash,
				custodyState: "RELEASE_HELD",
				custodyRevision: r.revision,
				state: "HEALTHY"
			},
			checkedAt: fact.checkedAt
		});
	}
	async prepare(p, authorize) {
		this.#enabled(p);
		if (p.state !== "SENT") throw new RunnerError("ACCEPTANCE_SERVICE_DISPATCH_GRANT_REQUIRED", 409);
		const data = await this.datasets.prepare(p, authorize);
		if (data.state !== "MATERIALIZED") return this.#unknown(data.errorCode);
		const request = await this.#request(p, data.receipt);
		if (!await this.#authorized(p, request, authorize)) return this.#unknown("ACCEPTANCE_SERVICE_AUTHORITY_REVOKED");
		const r = await this.store.request("acceptanceServiceReserve", {
			controllerId: this.options.controllerId,
			request,
			requestHash: hash$6(request),
			resourceLimits: this.options.resourceLimits,
			capacity: this.options.capacity
		}), j = await this.store.request("acceptanceServiceProfilePrepare", {
			...bound$1(r),
			profile: this.#profile(r)
		});
		if (r.state !== "RESERVED") return this.inspect(p);
		if (!await this.#authorized(p, request, authorize)) {
			await this.store.request("acceptanceServiceCancel", bound$1(r));
			return this.#unknown("ACCEPTANCE_SERVICE_AUTHORITY_REVOKED");
		}
		try {
			await this.driver.prepare(j.profile);
		} catch (error) {
			await this.store.request("acceptanceServiceCancel", bound$1(r));
			throw error;
		}
		if (!await this.#authorized(p, request, authorize)) {
			await this.store.request("acceptanceServiceCancel", bound$1(r));
			return this.#unknown("ACCEPTANCE_SERVICE_AUTHORITY_REVOKED");
		}
		if (!(await this.store.request("acceptanceServiceDispatch", bound$1(r))).dispatch) return this.inspect(p);
		for (const kind of [
			"NETWORK_CREATE",
			"CREATE",
			"START"
		]) {
			if (!await this.#authorized(p, request, authorize)) return this.#unknown("ACCEPTANCE_SERVICE_AUTHORITY_REVOKED");
			const grant = await this.store.request("acceptanceServiceActionBegin", {
				...bound$1(r),
				kind
			}), action = grant.journal.actions.find((a) => a.request.kind === kind);
			if (!grant.dispatch) return this.inspect(p);
			const current = grant.journal, allowed = async () => await this.#authorized(p, request, authorize) && (await this.store.request("acceptanceServiceActionAuthorized", {
				...bound$1(r),
				kind,
				actionRequestHash: action.requestHash
			})).allowed;
			if (kind === "NETWORK_CREATE") await this.#observe(r, current, kind, await this.driver.createNetwork(current.profile, request, allowed));
			else if (kind === "CREATE") {
				const f = await this.driver.create(current.profile, request, current.networkId, allowed);
				if (!f) return this.inspect(p);
				await this.#observe(r, current, kind, f);
			} else {
				const f = await this.driver.start(current.profile, request, current.networkId, current.containerId, allowed);
				if (!f) return this.inspect(p);
				await this.#observe(r, current, kind, f);
			}
		}
		return this.inspect(p);
	}
};
//#endregion
//#region src/acceptance-abort-backend.ts
const optionsSchema$4 = z.strictObject({
	enabled: z.boolean().default(false),
	runnerId: opaqueKey,
	controllerId: opaqueKey,
	backendRef: opaqueKey,
	principalId: opaqueKey
});
const inputSchema = z.strictObject({
	operationId: ids.operation,
	requestHash: sha256
});
const hash$5 = (v) => createHash("sha256").update(canonical(v)).digest("hex");
/** Explicit trusted composition. A model/caller cannot supply a cleanup decision. */
var RunnerAcceptanceAbortBackend = class {
	store;
	control;
	driver;
	options;
	constructor(store, control, driver, options) {
		this.store = store;
		this.control = control;
		this.driver = driver;
		this.options = optionsSchema$4.parse(options);
		if (store.options.runnerId !== this.options.runnerId) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
	}
	get configured() {
		return this.options.enabled && this.driver.configured;
	}
	async #decision(i) {
		const record = await this.control.request("getAcceptanceAbortDecision", {
			principalId: this.options.principalId,
			preparationOperationId: i.operationId,
			requestHash: i.requestHash
		});
		if (!record) throw new RunnerError("ACCEPTANCE_ABORT_NOT_REQUESTED", 409);
		const d = acceptanceAbortDecision.parse(record.decision), q = d.preparation;
		if (hash$5(d) !== record.decisionHash || q.operationId !== i.operationId || d.preparationRequestHash !== i.requestHash || q.runnerId !== this.options.runnerId || q.backendRef !== this.options.backendRef || q.backendPrincipalId !== this.options.principalId) throw new RunnerError("ACCEPTANCE_ABORT_IDENTITY_CHANGED", 409);
		return {
			decision: d,
			decisionHash: record.decisionHash
		};
	}
	async advance(raw, signal) {
		signal?.throwIfAborted();
		if (!this.configured) throw new RunnerError("ACCEPTANCE_ABORT_NOT_CONFIGURED", 503, "not-sent");
		const i = inputSchema.parse(raw), record = await this.#decision(i), b = {
			controllerId: this.options.controllerId,
			operationId: i.operationId,
			decisionHash: record.decisionHash
		};
		signal?.throwIfAborted();
		let current = await this.store.request("acceptanceAbortEnroll", {
			controllerId: b.controllerId,
			...record
		});
		if (current.networkCleared) return current;
		signal?.throwIfAborted();
		const r = current.reservation;
		if (!r) return current;
		const bound = {
			controllerId: r.controllerId,
			reservationId: r.reservationId,
			requestHash: r.requestHash
		};
		let j = await this.store.request("acceptanceServiceJournal", bound);
		if (!j) return current;
		try {
			signal?.throwIfAborted();
			if (!j.networkId) {
				const original = j.actions.find((a) => a.request.kind === "NETWORK_CREATE");
				if (!original) return current;
				const networkId = await this.driver.network(j.profile, r.request);
				if (!networkId) return current;
				j = await this.store.request("acceptanceServiceActionObserve", {
					...bound,
					kind: "NETWORK_CREATE",
					actionRequestHash: original.requestHash,
					observation: {
						objectId: networkId,
						state: "CREATED",
						checkedAt: (/* @__PURE__ */ new Date()).toISOString()
					}
				});
			}
			signal?.throwIfAborted();
			if (!j.containerId && j.actions.some((a) => a.request.kind === "CREATE")) {
				const f = await this.driver.inspect(j.profile, r.request, j.networkId, null);
				if (!f || f.state !== "created") return current;
				const original = j.actions.find((a) => a.request.kind === "CREATE");
				j = await this.store.request("acceptanceServiceActionObserve", {
					...bound,
					kind: "CREATE",
					actionRequestHash: original.requestHash,
					observation: {
						objectId: f.containerId,
						state: "CREATED",
						checkedAt: (/* @__PURE__ */ new Date()).toISOString()
					}
				});
			}
			const kinds = j.actions.some((a) => a.request.kind === "CREATE") ? [
				"STOP",
				"CONTAINER_REMOVE",
				"NETWORK_REMOVE"
			] : ["NETWORK_REMOVE"];
			for (const kind of kinds) {
				signal?.throwIfAborted();
				if ((await this.#decision(i)).decisionHash !== b.decisionHash) throw new RunnerError("ACCEPTANCE_ABORT_IDENTITY_CHANGED", 409);
				signal?.throwIfAborted();
				const grant = await this.store.request("acceptanceAbortActionBegin", {
					...b,
					kind
				}), a = grant.action;
				signal?.throwIfAborted();
				if (a.state === "OBSERVED") continue;
				const allowed = async () => !signal?.aborted && (await this.#decision(i)).decisionHash === b.decisionHash && !signal?.aborted && (await this.store.request("acceptanceAbortActionAuthorized", {
					...b,
					kind,
					actionRequestHash: a.requestHash
				})).allowed && !signal?.aborted;
				if (kind === "STOP") {
					const fact = grant.dispatch ? await this.driver.stop(j.profile, r.request, a.request.networkId, a.request.containerId, allowed) : await this.driver.inspect(j.profile, r.request, a.request.networkId, a.request.containerId);
					if (!fact || !["created", "exited"].includes(fact.state) || fact.containerId !== a.request.containerId) return this.store.request("acceptanceAbortGet", b);
					current = await this.store.request("acceptanceAbortActionObserve", {
						...b,
						kind,
						actionRequestHash: a.requestHash,
						observation: {
							kind: "STOP",
							objectId: fact.containerId,
							state: fact.state === "created" ? "CREATED" : "EXITED",
							checkedAt: (/* @__PURE__ */ new Date()).toISOString()
						}
					});
				} else {
					if (grant.dispatch) if (kind === "CONTAINER_REMOVE") await this.driver.removeContainer(j.profile, r.request, a.request.networkId, a.request.containerId, allowed);
					else await this.driver.removeNetwork(j.profile, r.request, a.request.networkId, allowed);
					if (!(kind === "CONTAINER_REMOVE" ? await this.driver.containerAbsent(a.request.containerId) : await this.driver.networkAbsent(a.request.networkId))) return this.store.request("acceptanceAbortGet", b);
					current = await this.store.request("acceptanceAbortActionObserve", {
						...b,
						kind,
						actionRequestHash: a.requestHash,
						observation: {
							kind,
							objectId: kind === "CONTAINER_REMOVE" ? a.request.containerId : a.request.networkId,
							absenceVerified: true,
							checkedAt: (/* @__PURE__ */ new Date()).toISOString()
						}
					});
				}
			}
		} catch (error) {
			if (!(error instanceof RunnerError) && !(error instanceof Error)) throw error;
			return this.store.request("acceptanceAbortGet", b);
		}
		return current;
	}
};
//#endregion
//#region src/release-retirement-backend.ts
const optionsSchema$3 = z.strictObject({
	enabled: z.boolean().default(false),
	runnerId: opaqueKey,
	controllerId: opaqueKey,
	backendRef: opaqueKey,
	principalId: opaqueKey
});
const hash$4 = (v) => createHash("sha256").update(canonical(v)).digest("hex");
/** Only the unique publication winner calls retire. This adapter implements the
* readonly retirement stage, not writable service creation or publication success. */
var RunnerReleaseRetirementBackend = class {
	store;
	control;
	driver;
	authority;
	options;
	constructor(store, control, driver, authority, options) {
		this.store = store;
		this.control = control;
		this.driver = driver;
		this.authority = authority;
		this.options = optionsSchema$3.parse(options);
		if (store.options.runnerId !== this.options.runnerId) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
	}
	get configured() {
		return this.options.enabled && this.driver.configured && this.authority.configured;
	}
	#bound(p) {
		if (!p.basis) throw new RunnerError("RELEASE_RETIREMENT_NOT_DISPATCHED", 409);
		const request = releaseRetirementRequest.parse({
			schemaVersion: "devmesh.release-retirement.v1",
			promotion: p.request,
			promotionRequestHash: p.requestHash,
			gates: p.basis
		});
		return {
			request,
			bound: {
				controllerId: this.options.controllerId,
				releaseId: p.releaseId,
				requestHash: hash$4(request)
			}
		};
	}
	async #current(p, authorize, continuation = false) {
		const q = p.request.preparation, o = this.options;
		if (q.runnerId !== o.runnerId || q.backendRef !== o.backendRef || q.backendPrincipalId !== o.principalId || q.releaseId !== p.releaseId || hash$4(p.request) !== p.requestHash) throw new RunnerError("RELEASE_RETIREMENT_IDENTITY_CHANGED", 409);
		const current = await this.control.request("getReleasePublication", {
			principalId: o.principalId,
			releaseId: p.releaseId
		});
		if (current.requestHash !== p.requestHash || canonical(current.request) !== canonical(p.request) || canonical(current.basis) !== canonical(p.basis) || current.dispatchedAt === null || current.state === "PENDING") throw new RunnerError("RELEASE_RETIREMENT_IDENTITY_CHANGED", 409);
		if (authorize && !(await this.control.request(continuation ? "verifyReleasePublicationContinuation" : "verifyReleasePublication", {
			principalId: o.principalId,
			releaseId: p.releaseId,
			requestHash: p.requestHash
		})).allowed) throw new RunnerError("RELEASE_RETIREMENT_AUTHORITY_CLOSED", 409);
	}
	async preflight(p, continuation = false) {
		if (!this.configured) throw new RunnerError("RELEASE_RETIREMENT_NOT_CONFIGURED", 503, "not-sent");
		const { request } = this.#bound(p);
		await this.#current(p, true, continuation);
		await this.authority.preflight(request);
	}
	async retire(p, authorize) {
		return this.#advance(p, authorize, false);
	}
	/** Explicit coordination; only unstarted stages receive new unique grants. */
	async resume(p, authorize) {
		return this.#advance(p, authorize, true);
	}
	async #advance(p, authorize, continuation) {
		if (p.state !== "SENT" && !(continuation && p.state === "UNKNOWN")) return this.inspect(p);
		await this.preflight(p, continuation);
		if (!await authorize()) throw new RunnerError("RELEASE_RETIREMENT_AUTHORITY_CLOSED", 409, "not-sent");
		const { request, bound } = this.#bound(p), grant = await this.store.request("releaseRetirementEnroll", {
			controllerId: bound.controllerId,
			request,
			requestHash: bound.requestHash
		});
		if (!grant.dispatch && !continuation) return this.inspect(p);
		let current = grant.journal;
		for (const kind of [
			"REVOKE_PREPARATION",
			"STOP",
			"CONTAINER_REMOVE",
			"NETWORK_REMOVE"
		]) try {
			await this.#current(p, true, continuation);
			if (!await authorize()) break;
			const g = await this.store.request("releaseRetirementActionBegin", {
				...bound,
				kind
			}), a = g.action;
			const allowed = async () => {
				try {
					await this.#current(p, true, continuation);
					return await authorize() && (await this.store.request("releaseRetirementActionAuthorized", {
						...bound,
						kind,
						actionRequestHash: a.requestHash
					})).allowed;
				} catch {
					return false;
				}
			};
			current = await this.#observe(p, current, a, g.dispatch, allowed);
			if (!current.actions.some((x) => x.request.kind === kind && x.state === "OBSERVED")) break;
		} catch {
			break;
		}
		return this.store.request("releaseRetirementGet", bound);
	}
	/** Never enroll, begin a stage, revoke, stop, remove or start from recovery. */
	async inspect(p) {
		if (!this.configured) throw new RunnerError("RELEASE_RETIREMENT_NOT_CONFIGURED", 503, "not-sent");
		await this.#current(p, false);
		const { bound } = this.#bound(p);
		let current = await this.store.request("releaseRetirementGet", bound);
		for (const a of current.actions) {
			if (a.state === "OBSERVED") continue;
			try {
				current = await this.#observe(p, current, a, false, async () => false);
			} catch {
				break;
			}
		}
		return current;
	}
	async #observe(p, j, a, dispatch, allowed) {
		const { bound } = this.#bound(p), kind = a.request.kind, r = j.reservation, original = j.original;
		if (a.state === "OBSERVED") return j;
		const checkedAt = () => (/* @__PURE__ */ new Date()).toISOString();
		if (kind === "REVOKE_PREPARATION") {
			const value = dispatch ? await this.authority.revoke(j.request, bound.controllerId, allowed) : await this.authority.inspect(j.request, bound.controllerId);
			if (!value) return j;
			const proof = releaseRetirementRevocation.parse(value);
			return this.store.request("releaseRetirementActionObserve", {
				...bound,
				kind,
				actionRequestHash: a.requestHash,
				observation: {
					kind,
					proof,
					checkedAt: checkedAt()
				}
			});
		}
		if (kind === "STOP") {
			const fact = dispatch ? await this.driver.stop(original.profile, r.request, a.request.networkId, a.request.containerId, allowed) : await this.driver.inspect(original.profile, r.request, a.request.networkId, a.request.containerId);
			if (!fact || fact.containerId !== a.request.containerId || fact.networkId !== a.request.networkId || !["created", "exited"].includes(fact.state)) return j;
			return this.store.request("releaseRetirementActionObserve", {
				...bound,
				kind,
				actionRequestHash: a.requestHash,
				observation: {
					kind,
					objectId: fact.containerId,
					state: fact.state === "created" ? "CREATED" : "EXITED",
					checkedAt: checkedAt()
				}
			});
		}
		if (dispatch) if (kind === "CONTAINER_REMOVE") await this.driver.removeContainer(original.profile, r.request, a.request.networkId, a.request.containerId, allowed);
		else await this.driver.removeNetwork(original.profile, r.request, a.request.networkId, allowed);
		if (!(kind === "CONTAINER_REMOVE" ? await this.driver.containerAbsent(a.request.containerId) : await this.driver.networkAbsent(a.request.networkId))) return j;
		return this.store.request("releaseRetirementActionObserve", {
			...bound,
			kind,
			actionRequestHash: a.requestHash,
			observation: {
				kind,
				objectId: kind === "CONTAINER_REMOVE" ? a.request.containerId : a.request.networkId,
				absenceVerified: true,
				checkedAt: checkedAt()
			}
		});
	}
};
//#endregion
//#region src/preview-backend.ts
const optionsSchema$2 = z.strictObject({
	enabled: z.boolean().default(false),
	runnerId: opaqueKey,
	controllerId: opaqueKey,
	backendRef: opaqueKey,
	repository: previewRepository,
	capacity: runnerCapacity,
	resourceLimits: previewResourceLimits,
	datasetBytes: z.number().int().min(4096).max(256 * 1024 * 1024).default(64 * 1024 * 1024)
});
const hash$3 = (v) => createHash("sha256").update(canonical(v)).digest("hex");
const bound = (r) => ({
	controllerId: r.controllerId,
	reservationId: r.reservationId,
	requestHash: r.requestHash
});
/** Explicit trusted composition, no public registration or container-receipt API. */
var RunnerPreviewBackend = class {
	store;
	paths;
	datasets;
	driver;
	configured;
	options;
	constructor(store, paths, datasets, driver, options) {
		this.store = store;
		this.paths = paths;
		this.datasets = datasets;
		this.driver = driver;
		this.options = optionsSchema$2.parse(options);
		if (this.options.runnerId !== store.options.runnerId || paths.options.runnerId !== store.options.runnerId) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
		this.configured = this.options.enabled && driver.configured && datasets.configured;
	}
	#enabled() {
		if (!this.configured) throw new RunnerError("PREVIEW_RUNNER_NOT_CONFIGURED", 503, "not-sent");
	}
	#request(effect) {
		const r = effect.kind === "PREVIEW_START" ? previewStartRequest.parse(effect.request) : effect.kind === "PREVIEW_STOP" ? previewStopRequest.parse(effect.request) : null;
		if (!r || r.operationId !== effect.operationId || r.projectId !== effect.projectId || r.runId !== effect.runId || r.candidateId !== effect.candidateId || r.previewId !== effect.previewId || r.datasetId !== effect.datasetId || r.policyHash !== effect.policyHash || effect.remoteKey !== r.previewId || hash$3(r) !== effect.requestHash || r.runnerId !== this.options.runnerId || r.backendRef !== this.options.backendRef) throw new RunnerError("PREVIEW_ORIGINAL_REQUEST_CHANGED", 409);
		return r;
	}
	#profile(r) {
		return previewContainerProfile.parse({
			schemaVersion: "devmesh.preview-container-profile.v1",
			reservationId: r.reservationId,
			requestHash: r.requestHash,
			repository: this.options.repository,
			datasetDirectory: this.paths.resolve(r.request).directory,
			datasetBytes: this.options.datasetBytes,
			resourceLimits: r.resourceLimits,
			...previewContainerNames(r.reservationId)
		});
	}
	async preflight(effect, datasetEffect) {
		this.#enabled();
		const r = this.#request(effect);
		if (r.schemaVersion === "devmesh.preview-stop.v1") {
			if (!await this.#reservation(r)) throw new RunnerError("PREVIEW_ORIGINAL_RESERVATION_MISSING", 409);
			return;
		}
		if (r.templateVersion !== "web-crud-v1" || r.schemaRevision !== "web-crud-v1.schema.1" || r.datasetOperationId !== datasetEffect.operationId || r.datasetId !== datasetEffect.datasetId || r.projectId !== datasetEffect.projectId || r.candidateId !== datasetEffect.candidateId || r.manifestHash !== datasetEffect.request.manifestHash || datasetEffect.state !== "SUCCEEDED" || datasetEffect.receipt?.kind !== "DATASET_READY" || r.storageKey !== datasetEffect.receipt.storageKey) throw new RunnerError("PREVIEW_DATASET_CHANGED", 409);
		const actual = await this.datasets.inspect(datasetEffect);
		if (actual.state !== "SUCCEEDED" || canonical(actual.receipt) !== canonical(datasetEffect.receipt)) throw new RunnerError("PREVIEW_DATASET_UNVERIFIED", 409);
		this.paths.resolve(r);
		await this.store.request("capacityConfigure", this.options.capacity);
		await this.driver.probe(r, this.options.repository);
	}
	async #reservation(r) {
		const reservation = await this.store.request("previewReservationByOperation", {
			controllerId: this.options.controllerId,
			operationId: r.schemaVersion === "devmesh.preview-start.v1" ? r.operationId : r.startOperationId
		});
		if (reservation) {
			const original = reservation.request;
			if (r.schemaVersion === "devmesh.preview-start.v1") {
				if (hash$3(r) !== reservation.requestHash) throw new RunnerError("PREVIEW_ORIGINAL_REQUEST_CHANGED", 409);
			} else {
				if (r.startRequestHash !== reservation.requestHash || reservation.instanceId !== r.instanceId) throw new RunnerError("PREVIEW_ORIGINAL_REQUEST_CHANGED", 409);
				for (const k of [
					"projectId",
					"runId",
					"candidateId",
					"policyHash",
					"backendRef",
					"runnerId",
					"previewId",
					"datasetId",
					"imageDigest"
				]) if (r[k] !== original[k]) throw new RunnerError("PREVIEW_ORIGINAL_REQUEST_CHANGED", 409);
			}
		}
		return reservation;
	}
	#result(effect, fact) {
		if (effect.kind === "PREVIEW_START" && fact.state === "HEALTHY") return {
			fact,
			observation: {
				state: "SUCCEEDED",
				receipt: {
					kind: "PREVIEW_READY",
					previewId: fact.previewId,
					datasetId: fact.datasetId,
					imageDigest: fact.imageDigest,
					instanceId: fact.instanceId,
					healthy: true,
					checkedAt: fact.checkedAt
				}
			}
		};
		if (effect.kind === "PREVIEW_STOP" && fact.state === "EXITED") return {
			fact,
			observation: {
				state: "SUCCEEDED",
				receipt: {
					kind: "PREVIEW_STOPPED",
					previewId: fact.previewId,
					instanceId: fact.instanceId,
					exitVerified: true,
					checkedAt: fact.checkedAt
				}
			}
		};
		if (effect.kind === "PREVIEW_STOP" && fact.state === "REMOVED") return {
			fact,
			observation: {
				state: "SUCCEEDED",
				receipt: {
					kind: "PREVIEW_REMOVED",
					previewId: fact.previewId,
					instanceId: fact.instanceId,
					removalVerified: true,
					checkedAt: fact.checkedAt
				}
			}
		};
		if (effect.kind === "PREVIEW_START" && fact.state === "REMOVED") return {
			fact,
			observation: {
				state: "FAILED",
				errorCode: "PREVIEW_ORIGINAL_REMOVED",
				absenceVerified: true
			}
		};
		if (effect.kind === "PREVIEW_START" && fact.state === "EXITED") return {
			fact,
			observation: {
				state: "FAILED",
				errorCode: "PREVIEW_ORIGINAL_EXITED",
				absenceVerified: true
			}
		};
		return {
			fact,
			observation: {
				state: "UNKNOWN",
				errorCode: "PREVIEW_ORIGINAL_UNVERIFIED"
			}
		};
	}
	#unknown(effect) {
		const r = this.#request(effect);
		return this.#result(effect, previewRuntimeFact.parse({
			previewId: r.previewId,
			datasetId: r.datasetId,
			imageDigest: r.imageDigest,
			state: "UNKNOWN",
			instanceId: null,
			endpoint: null,
			checkedAt: (/* @__PURE__ */ new Date()).toISOString()
		}));
	}
	async #observe(r, j, kind, f) {
		const action = j.actions.find((a) => a.kind === kind);
		if (!action || action.state === "OBSERVED") return j;
		const state = typeof f === "string" ? "CREATED" : f.state === "exited" ? "EXITED" : f.state === "running" ? "RUNNING" : f.state === "created" ? "CREATED" : null;
		if (!state || kind === "START" && state === "CREATED" || kind === "STOP" && state !== "EXITED") return j;
		return this.store.request("previewContainerActionObserve", {
			...bound(r),
			kind,
			actionRequestHash: action.requestHash,
			observation: {
				objectId: typeof f === "string" ? f : f.containerId,
				state,
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			}
		});
	}
	async inspect(effect) {
		this.#enabled();
		const request = this.#request(effect), r = await this.#reservation(request);
		if (!r) return this.#unknown(effect);
		let removal = (await this.store.request("previewCleanupGet", bound(r))).find((a) => a.request.kind === "CONTAINER_REMOVE");
		if (removal?.state === "SENT" && await this.driver.containerAbsent(removal.request.containerId)) removal = await this.store.request("previewCleanupActionObserve", {
			...bound(r),
			kind: "CONTAINER_REMOVE",
			actionRequestHash: removal.requestHash,
			observation: {
				objectId: removal.request.containerId,
				absenceVerified: true,
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			}
		});
		if (removal?.state === "OBSERVED") return this.#result(effect, previewRuntimeFact.parse({
			previewId: r.request.previewId,
			datasetId: r.request.datasetId,
			imageDigest: r.request.imageDigest,
			state: "REMOVED",
			instanceId: removal.request.containerId,
			endpoint: null,
			checkedAt: (/* @__PURE__ */ new Date()).toISOString()
		}));
		if (r.state === "CANCELLED" && effect.kind === "PREVIEW_START") return {
			...this.#unknown(effect),
			observation: {
				state: "FAILED",
				errorCode: "PREVIEW_CANCELLED_WITHOUT_DISPATCH",
				absenceVerified: true
			}
		};
		let j = await this.store.request("previewContainerGet", bound(r));
		if (!j) return this.#unknown(effect);
		const networkId = await this.driver.network(j.profile, r.request);
		if (!networkId) return this.#unknown(effect);
		if (j.networkId !== null && j.networkId !== networkId) throw new RunnerError("PREVIEW_CONTAINER_IDENTITY_CHANGED", 409);
		j = await this.#observe(r, j, "NETWORK_CREATE", networkId);
		if (!j.networkId || !j.actions.some((a) => a.kind === "CREATE")) return this.#unknown(effect);
		const f = await this.driver.inspect(j.profile, r.request, j.networkId, j.containerId);
		if (!f) return this.#unknown(effect);
		j = await this.#observe(r, j, "CREATE", f);
		if (j.containerId !== f.containerId) throw new RunnerError("PREVIEW_CONTAINER_IDENTITY_CHANGED", 409);
		j = await this.#observe(r, j, "START", f);
		await this.#observe(r, j, "STOP", f);
		const healthy = f.state === "running" && f.endpoint ? await probePreviewHealth(f.endpoint) : false;
		const fact = previewRuntimeFact.parse({
			previewId: r.request.previewId,
			datasetId: r.request.datasetId,
			imageDigest: r.request.imageDigest,
			state: f.state === "running" ? healthy ? "HEALTHY" : "UNHEALTHY" : f.state === "created" ? "CREATED" : f.state === "exited" ? "EXITED" : "UNKNOWN",
			instanceId: f.state === "unknown" ? null : f.containerId,
			endpoint: f.state === "running" ? f.endpoint : null,
			checkedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		if (![
			"EXITED",
			"CANCELLED",
			"REMOVED"
		].includes(r.state)) await this.store.request("previewReservationRecord", {
			...bound(r),
			expectedRevision: r.revision,
			fact
		});
		return this.#result(effect, fact);
	}
	async execute(effect, datasetEffect, authorize) {
		await this.preflight(effect, datasetEffect);
		if (effect.state !== "SENT") throw new RunnerError("PREVIEW_DISPATCH_GRANT_REQUIRED", 409);
		const request = this.#request(effect);
		if (request.schemaVersion === "devmesh.preview-stop.v1") {
			const r = await this.#reservation(request), j = await this.store.request("previewContainerGet", bound(r));
			if (!j?.networkId || !j.containerId || !await authorize()) return this.inspect(effect);
			if ((await this.store.request("previewCleanupGet", bound(r))).some((a) => a.request.kind === "CONTAINER_REMOVE")) return this.inspect(effect);
			if ((await this.driver.inspect(j.profile, r.request, j.networkId, j.containerId))?.state === "exited") return this.inspect(effect);
			if (!await authorize()) return this.inspect(effect);
			if (!(await this.store.request("previewContainerActionBegin", {
				...bound(r),
				action: {
					kind: "STOP",
					requestHash: effect.requestHash,
					request
				}
			})).dispatch || !await authorize()) return this.inspect(effect);
			await this.driver.stop(j.profile, r.request, j.networkId, j.containerId, async () => await authorize() && (await this.store.request("previewLifecycleActionAuthorized", {
				...bound(r),
				kind: "STOP",
				actionRequestHash: effect.requestHash
			})).allowed);
			return this.inspect(effect);
		}
		if (!await authorize()) return this.#unknown(effect);
		const r = await this.store.request("previewReserve", {
			controllerId: this.options.controllerId,
			request,
			requestHash: effect.requestHash,
			resourceLimits: this.options.resourceLimits,
			capacity: this.options.capacity
		});
		await this.store.request("previewLifecycleEnroll", bound(r));
		const j = await this.store.request("previewContainerPrepare", {
			...bound(r),
			profile: this.#profile(r)
		});
		if (r.state !== "RESERVED") return this.inspect(effect);
		try {
			await this.driver.prepare(j.profile);
		} catch (error) {
			await this.store.request("previewReservationCancel", bound(r));
			throw error;
		}
		if (!await authorize()) {
			await this.store.request("previewReservationCancel", bound(r));
			return this.inspect(effect);
		}
		if (!(await this.store.request("previewReservationDispatch", bound(r))).dispatch) return this.inspect(effect);
		for (const kind of [
			"NETWORK_CREATE",
			"CREATE",
			"START"
		]) {
			if (!await authorize()) return this.inspect(effect);
			const grant = await this.store.request("previewContainerActionBegin", {
				...bound(r),
				action: {
					kind,
					requestHash: effect.requestHash,
					request
				}
			});
			if (!grant.dispatch || !await authorize()) return this.inspect(effect);
			const current = grant.journal;
			const currentAuthority = async () => await authorize() && (await this.store.request("previewLifecycleActionAuthorized", {
				...bound(r),
				kind,
				actionRequestHash: effect.requestHash
			})).allowed;
			if (kind === "NETWORK_CREATE") await this.#observe(r, current, kind, await this.driver.createNetwork(current.profile, request, currentAuthority));
			else if (kind === "CREATE") {
				const f = await this.driver.create(current.profile, request, current.networkId, currentAuthority);
				if (!f) return this.inspect(effect);
				await this.#observe(r, current, kind, f);
			} else {
				const f = await this.driver.start(current.profile, request, current.networkId, current.containerId, currentAuthority);
				if (!f) return this.inspect(effect);
				await this.#observe(r, current, kind, f);
			}
		}
		return this.inspect(effect);
	}
	/** Original-ID removal. Existing SENT actions only query, including after restart. */
	async cleanupReservation(reservationId, isOpen = () => true) {
		this.#enabled();
		const r = await this.store.request("previewReservationGet", {
			controllerId: this.options.controllerId,
			reservationId: opaqueKey.parse(reservationId)
		}), life = await this.store.request("previewLifecycleGet", bound(r));
		if (!life || life.state !== "STOPPING" || !isOpen()) return { state: life?.state ?? "UNENROLLED" };
		const j = await this.store.request("previewContainerGet", bound(r));
		if (!j?.containerId || !j.networkId || !j.actions.some((a) => a.kind === "STOP")) return { state: "UNKNOWN" };
		for (const kind of ["CONTAINER_REMOVE", "NETWORK_REMOVE"]) {
			if (!isOpen()) return { state: "UNKNOWN" };
			let action = (await this.store.request("previewCleanupGet", bound(r))).find((a) => a.request.kind === kind);
			if (action?.state === "OBSERVED") continue;
			const id = kind === "CONTAINER_REMOVE" ? j.containerId : j.networkId, absent = () => kind === "CONTAINER_REMOVE" ? this.driver.containerAbsent(id) : this.driver.networkAbsent(id);
			let gone = await absent();
			if (!action) {
				if (kind === "CONTAINER_REMOVE" && !gone) {
					const original = await this.driver.inspect(j.profile, r.request, j.networkId, j.containerId);
					if (!original || !["created", "exited"].includes(original.state)) return { state: "UNKNOWN" };
				}
				if (!isOpen()) return { state: "UNKNOWN" };
				const grant = await this.store.request("previewCleanupActionBegin", {
					...bound(r),
					kind
				});
				action = grant.action;
				if (grant.dispatch && !gone) {
					const actionRequestHash = action.requestHash, authorize = async () => isOpen() && (await this.store.request("previewCleanupActionAuthorized", {
						...bound(r),
						kind,
						actionRequestHash
					})).allowed;
					if (kind === "CONTAINER_REMOVE") await this.driver.removeContainer(j.profile, r.request, j.networkId, j.containerId, authorize);
					else await this.driver.removeNetwork(j.profile, r.request, j.networkId, authorize);
					gone = await absent();
				}
			}
			if (!gone) return { state: "UNKNOWN" };
			if (action.state !== "OBSERVED") await this.store.request("previewCleanupActionObserve", {
				...bound(r),
				kind,
				actionRequestHash: action.requestHash,
				observation: {
					objectId: id,
					absenceVerified: true,
					checkedAt: (/* @__PURE__ */ new Date()).toISOString()
				}
			});
		}
		return { state: (await this.store.request("previewReservationGet", {
			controllerId: this.options.controllerId,
			reservationId
		})).state };
	}
	/** Runner-only expiry path; never depends on a control database connection. */
	async expireReservation(reservationId, isOpen = () => true) {
		this.#enabled();
		let r = await this.store.request("previewReservationGet", {
			controllerId: this.options.controllerId,
			reservationId: opaqueKey.parse(reservationId)
		});
		let life = await this.store.request("previewLifecycleGet", bound(r));
		if (!life) return {
			state: "UNENROLLED",
			result: null
		};
		if (life.state.startsWith("RELEASE_")) return {
			state: life.state,
			result: null
		};
		life = await this.store.request("previewExpiryPrepare", bound(r));
		if (!life || life.state !== "STOPPING" || !isOpen()) return {
			state: life?.state ?? "UNENROLLED",
			result: null
		};
		if (r.state === "RESERVED") {
			await this.store.request("previewReservationCancel", bound(r));
			return {
				state: "CANCELLED",
				result: null
			};
		}
		const request = r.request, start = {
			operationId: request.operationId,
			projectId: request.projectId,
			runId: request.runId,
			candidateId: request.candidateId,
			datasetId: request.datasetId,
			previewId: request.previewId,
			policyHash: request.policyHash,
			kind: "PREVIEW_START",
			remoteKey: request.previewId,
			requestHash: r.requestHash,
			request,
			state: "SENT",
			revision: 0,
			receipt: null,
			errorCode: null,
			createdAt: r.createdAt
		};
		const observed = await this.inspect(start);
		r = await this.store.request("previewReservationGet", {
			controllerId: this.options.controllerId,
			reservationId
		});
		if (r.releasedAt) return {
			state: r.state,
			result: observed
		};
		life = await this.store.request("previewExpiryPrepare", bound(r));
		const journal = await this.store.request("previewContainerGet", bound(r));
		if (!life?.expiryRequest || !life.expiryRequestHash || journal?.actions.some((a) => a.kind === "STOP") || !isOpen()) return {
			state: life?.state ?? "UNENROLLED",
			result: observed
		};
		const effect = {
			...start,
			operationId: life.expiryRequest.operationId,
			kind: "PREVIEW_STOP",
			requestHash: life.expiryRequestHash,
			request: life.expiryRequest
		};
		const expiryRequestHash = life.expiryRequestHash, result = await this.execute(effect, start, async () => isOpen() && (await this.store.request("previewExpiryAuthorized", {
			...bound(r),
			expiryRequestHash
		})).allowed);
		return {
			state: (await this.store.request("previewReservationGet", {
				controllerId: this.options.controllerId,
				reservationId
			})).state,
			result
		};
	}
};
//#endregion
//#region src/preview-watchdog.ts
const optionsSchema$1 = z.strictObject({
	enabled: z.boolean().default(false),
	pollIntervalMs: z.number().int().min(100).max(3e4).default(1e3),
	pageSize: z.number().int().min(1).max(100).default(20)
});
/** A Runner-local loop, deliberately independent of platform/control liveness. */
var RunnerPreviewWatchdog = class {
	backend;
	options;
	#closed = false;
	#timer;
	#tick;
	constructor(backend, options = {}) {
		this.backend = backend;
		this.options = optionsSchema$1.parse(options);
	}
	#configured() {
		if (this.#closed) throw new RunnerError("PREVIEW_WATCHDOG_CLOSED", 503);
		if (!this.options.enabled || !this.backend.configured) throw new RunnerError("PREVIEW_WATCHDOG_NOT_CONFIGURED", 503);
	}
	async #cycle() {
		const results = [];
		let afterSequence = 0;
		do {
			const page = await this.backend.store.request("previewReservationPage", {
				controllerId: this.backend.options.controllerId,
				afterSequence,
				limit: this.options.pageSize
			});
			for (const { reservation } of page.items) {
				if (this.#closed) break;
				try {
					const result = await this.backend.expireReservation(reservation.reservationId, () => !this.#closed);
					results.push({
						reservationId: reservation.reservationId,
						state: result.state,
						errorCode: null
					});
				} catch (error) {
					results.push({
						reservationId: reservation.reservationId,
						state: reservation.state,
						errorCode: error instanceof RunnerError ? error.code : "PREVIEW_WATCHDOG_UNKNOWN"
					});
				}
			}
			if (page.nextSequence === null) break;
			afterSequence = page.nextSequence;
		} while (!this.#closed);
		afterSequence = 0;
		while (!this.#closed) {
			const page = await this.backend.store.request("previewCleanupPage", {
				controllerId: this.backend.options.controllerId,
				afterSequence,
				limit: this.options.pageSize
			});
			for (const { reservationId } of page.items) {
				if (this.#closed) break;
				let result;
				try {
					result = {
						reservationId,
						state: (await this.backend.cleanupReservation(reservationId, () => !this.#closed)).state,
						errorCode: null
					};
				} catch (error) {
					result = {
						reservationId,
						state: "UNKNOWN",
						errorCode: error instanceof RunnerError ? error.code : "PREVIEW_WATCHDOG_UNKNOWN"
					};
				}
				const index = results.findIndex((r) => r.reservationId === reservationId);
				if (index < 0) results.push(result);
				else if (results[index].errorCode === null) results[index] = result;
			}
			if (page.nextSequence === null) break;
			afterSequence = page.nextSequence;
		}
		return results;
	}
	async reconcile() {
		this.#configured();
		if (this.#tick) return this.#tick;
		this.#tick = this.#cycle();
		try {
			return await this.#tick;
		} finally {
			this.#tick = void 0;
		}
	}
	async start(onError) {
		this.#configured();
		if (this.#timer || this.#tick) throw new RunnerError("PREVIEW_WATCHDOG_ALREADY_STARTED", 409);
		const report = (code) => {
			try {
				onError?.(code);
			} catch {}
		};
		const first = await this.reconcile();
		if (!this.#closed) {
			this.#timer = setInterval(() => {
				if (!this.#tick) this.reconcile().then((results) => {
					for (const result of results) if (result.errorCode) report(result.errorCode);
				}).catch(() => report("PREVIEW_WATCHDOG_UNKNOWN"));
			}, this.options.pollIntervalMs);
			this.#timer.unref();
		}
		return first;
	}
	async close() {
		this.#closed = true;
		clearInterval(this.#timer);
		await this.#tick;
	}
};
//#endregion
//#region src/preview-http.ts
const sha$1 = (value) => createHash("sha256").update(value).digest("hex");
const allowedHeaders$1 = /* @__PURE__ */ new Set([
	"accept",
	"accept-language",
	"content-type",
	"if-match",
	"if-none-match",
	"range",
	"idempotency-key"
]);
/** Only compose on the Runner owning the original reservation and loopback port. */
var RunnerPreviewHttpTransport = class {
	backend;
	maximumResponseBytes;
	timeoutMs;
	configured;
	constructor(backend, maximumResponseBytes = 4 * 1024 * 1024, timeoutMs = 15e3) {
		this.backend = backend;
		this.maximumResponseBytes = maximumResponseBytes;
		this.timeoutMs = timeoutMs;
		if (!Number.isSafeInteger(maximumResponseBytes) || maximumResponseBytes < 1024 || maximumResponseBytes > 16 * 1024 * 1024 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3e4) throw new RunnerError("PREVIEW_HTTP_LIMIT_INVALID", 422, "not-sent");
		this.configured = backend.configured;
	}
	async #validate(input) {
		const deny = (code) => {
			throw new RunnerError(code, 503, "not-sent");
		};
		if (!this.configured) deny("PREVIEW_HTTP_NOT_CONFIGURED");
		const { record, headers, body, signal } = input, t = record.target;
		const request = previewAccessHttpRequest.parse(record.request);
		if (record.state !== "DISPATCHED" || record.requestHash !== sha$1(canonical({
			target: record.target,
			request: record.request,
			gateFence: record.gateFence
		})) || !request.headersSha256 || request.headersSha256 !== sha$1(canonical(headers)) || request.bodySha256 !== sha$1(body) || body.byteLength > 1024 * 1024) deny("PREVIEW_HTTP_REQUEST_CHANGED");
		for (const [name, value] of Object.entries(headers)) if (!allowedHeaders$1.has(name) || /[\r\n\0]/.test(value) || value.length > 8192) deny("PREVIEW_HTTP_HEADER_FORBIDDEN");
		if (signal.aborted || t.runnerId !== this.backend.options.runnerId || t.backendRef !== this.backend.options.backendRef || t.endpoint.host !== "127.0.0.1") deny("PREVIEW_HTTP_WRONG_RUNNER");
		const reservation = await this.backend.store.request("previewReservationByOperation", {
			controllerId: this.backend.options.controllerId,
			operationId: t.startOperationId
		});
		if (!reservation || reservation.releasedAt || reservation.requestHash !== t.startRequestHash || reservation.instanceId !== t.instanceId || canonical(reservation.endpoint) !== canonical(t.endpoint)) deny("PREVIEW_HTTP_ORIGINAL_UNAVAILABLE");
		const r = reservation, original = r.request;
		for (const name of [
			"projectId",
			"runId",
			"candidateId",
			"manifestHash",
			"policyHash",
			"datasetId",
			"datasetOperationId",
			"previewId",
			"imageDigest",
			"runnerId",
			"backendRef",
			"expiresAt"
		]) if (original[name] !== t[name]) deny("PREVIEW_HTTP_ORIGINAL_CHANGED");
		if (Date.parse(t.expiresAt) <= Date.now() || Date.parse(r.createdAt) > Date.now()) deny("PREVIEW_HTTP_EXPIRED");
		const effect = {
			operationId: original.operationId,
			projectId: original.projectId,
			runId: original.runId,
			candidateId: original.candidateId,
			datasetId: original.datasetId,
			previewId: original.previewId,
			policyHash: original.policyHash,
			kind: "PREVIEW_START",
			remoteKey: original.previewId,
			requestHash: r.requestHash,
			request: original,
			state: "SENT",
			revision: 0,
			receipt: null,
			errorCode: null,
			createdAt: r.createdAt
		};
		const { fact } = await this.backend.inspect(effect);
		if (fact.state !== "HEALTHY" || fact.instanceId !== t.instanceId || fact.imageDigest !== t.imageDigest || fact.datasetId !== t.datasetId || canonical(fact.endpoint) !== canonical(t.endpoint)) deny("PREVIEW_HTTP_ORIGINAL_UNHEALTHY");
		const bound = {
			controllerId: this.backend.options.controllerId,
			reservationId: r.reservationId,
			requestHash: r.requestHash
		};
		const life = await this.backend.store.request("previewLifecycleGet", bound);
		const latest = await this.backend.store.request("previewReservationGet", {
			controllerId: bound.controllerId,
			reservationId: r.reservationId
		});
		if (signal.aborted || !life || life.state !== "PREVIEW" || life.expiredAt || latest.releasedAt || latest.state !== "ACTIVE" || latest.instanceId !== t.instanceId || canonical(latest.endpoint) !== canonical(t.endpoint)) deny("PREVIEW_HTTP_LIFECYCLE_CLOSED");
		if (signal.aborted || Date.parse(t.expiresAt) <= Date.now() || !await input.authorize()) deny("PREVIEW_HTTP_AUTHORIZATION_LOST");
		return {
			request,
			target: t
		};
	}
	async forward(input) {
		const { request: request$2, target: t } = await this.#validate(input).catch((error) => {
			throw new RunnerError(error instanceof RunnerError ? error.code : "PREVIEW_HTTP_ORIGINAL_UNVERIFIED", 503, "not-sent");
		}), { headers, body, signal } = input;
		return new Promise((resolve, reject) => {
			let settled = false;
			const fail = () => {
				if (!settled) {
					settled = true;
					reject(new RunnerError("PREVIEW_HTTP_OUTCOME_UNKNOWN", 502, "unknown"));
				}
			};
			const req = request({
				host: "127.0.0.1",
				port: t.endpoint.port,
				method: request$2.method,
				path: request$2.path,
				agent: false,
				signal,
				headers: {
					...headers,
					host: `127.0.0.1:${t.endpoint.port}`,
					"content-length": body.byteLength
				}
			}, (res) => {
				if (!res.statusCode || res.statusCode < 200 || res.statusCode > 599) {
					res.destroy();
					fail();
					return;
				}
				const chunks = [];
				let size = 0;
				res.on("data", (chunk) => {
					size += chunk.length;
					if (size > this.maximumResponseBytes) {
						res.destroy();
						req.destroy();
						fail();
					} else chunks.push(chunk);
				});
				res.on("error", fail);
				res.on("aborted", fail);
				res.on("end", () => {
					if (settled) return;
					if (!res.complete) {
						fail();
						return;
					}
					settled = true;
					const responseHeaders = {};
					for (const [name, value] of Object.entries(res.headers)) if (value !== void 0) responseHeaders[name] = value;
					resolve({
						status: res.statusCode,
						headers: responseHeaders,
						body: Buffer.concat(chunks)
					});
				});
			});
			req.on("error", fail);
			req.on("upgrade", (_res, socket) => {
				socket.destroy();
				fail();
			});
			const timer = setTimeout(() => {
				req.destroy();
				fail();
			}, this.timeoutMs);
			timer.unref();
			req.on("close", () => clearTimeout(timer));
			req.end(body);
		});
	}
};
//#endregion
//#region src/preview-docker.ts
function previewDockerRemovalArguments(kind, id) {
	dockerObjectId.parse(id);
	return kind === "CONTAINER_REMOVE" ? [
		"container",
		"rm",
		id
	] : [
		"network",
		"rm",
		id
	];
}
/** Only a successful full-ID list query may establish absence. */
function verifyPreviewDockerAbsence(output, id) {
	dockerObjectId.parse(id);
	const value = output.trim();
	if (value === "") return true;
	if (value === id) return false;
	throw new RunnerError("PREVIEW_CLEANUP_QUERY_UNVERIFIED", 409, "unknown");
}
const hash$2 = (v) => createHash("sha256").update(canonical(v)).digest("hex");
const fail = (code) => {
	throw new RunnerError(code, 409, "unknown");
};
const labels = (p, r) => ({
	"devmesh.runner": r.runnerId,
	"devmesh.preview": r.previewId,
	"devmesh.reservation": p.reservationId,
	"devmesh.request": p.requestHash,
	"devmesh.profile": hash$2(p)
});
const subject$1 = (p, r) => ({
	imageDigest: r.imageDigest,
	imageIdentity: r.imageIdentity,
	labels: p ? labels(p, r) : {},
	readonlyDataset: false,
	errorPrefix: "PREVIEW"
});
function previewDockerNetworkArguments(raw, r) {
	const p = previewContainerProfile.parse(raw);
	return serviceDockerNetworkArguments(p, subject$1(p, r));
}
function previewDockerCreateArguments(raw, r, networkId) {
	const p = previewContainerProfile.parse(raw);
	return serviceDockerCreateArguments(p, subject$1(p, r), networkId);
}
function verifyPreviewDockerImage(value, r, repository) {
	return verifyServiceDockerImage(value, subject$1(null, r), repository);
}
function verifyPreviewDockerNetwork(value, p, r) {
	return verifyServiceDockerNetwork(value, p, subject$1(p, r));
}
function verifyPreviewDockerContainer(value, p, r, networkId, containerId) {
	return verifyServiceDockerContainer(value, p, subject$1(p, r), networkId, containerId);
}
var DockerPreviewDriver = class {
	configured;
	#execute;
	#options;
	constructor(options, executor) {
		if (!isAbsolute(options.dockerPath) || !options.socketPath.startsWith("/") || /[\0\r\n]/.test(options.socketPath)) throw new RunnerError("PREVIEW_DOCKER_CONFIG_INVALID", 422);
		this.#options = { ...options };
		this.configured = options.enabled === true && process.platform === "linux" && !!options.quota && !!options.networkIsolation;
		this.#execute = executor ?? ((args, timeoutMs, maximumBytes) => new Promise((resolve, reject) => {
			const child = spawn(options.dockerPath, [
				"--host",
				"unix://" + options.socketPath,
				...args
			], {
				shell: false,
				windowsHide: true,
				stdio: [
					"ignore",
					"pipe",
					"ignore"
				],
				env: {
					PATH: "/usr/local/bin:/usr/bin:/bin",
					LANG: "C.UTF-8"
				}
			});
			let count = 0;
			const chunks = [];
			const timer = setTimeout(() => {
				child.kill("SIGKILL");
				reject(new RunnerError("PREVIEW_DOCKER_UNKNOWN", 503, "unknown"));
			}, timeoutMs);
			timer.unref();
			child.stdout.on("data", (b) => {
				count += b.length;
				if (count > maximumBytes) {
					child.kill("SIGKILL");
					reject(new RunnerError("PREVIEW_DOCKER_OUTPUT_LIMIT", 503, "unknown"));
				} else chunks.push(b);
			});
			child.once("error", () => {
				clearTimeout(timer);
				reject(new RunnerError("PREVIEW_DOCKER_UNAVAILABLE", 503, "unknown"));
			});
			child.once("close", (code) => {
				clearTimeout(timer);
				resolve({
					code: code ?? -1,
					stdout: Buffer.concat(chunks).toString("utf8")
				});
			});
		}));
	}
	#enabled() {
		if (!this.configured) throw new RunnerError("PREVIEW_DOCKER_NOT_CONFIGURED", 503, "not-sent");
	}
	async #call(args) {
		this.#enabled();
		const r = await this.#execute(args, 15e3, 256 * 1024);
		if (r.code !== 0) throw new RunnerError("PREVIEW_DOCKER_UNKNOWN", 503, "unknown");
		return r.stdout;
	}
	async probe(r, repository) {
		this.#enabled();
		const info = z.object({
			OSType: z.literal("linux"),
			CgroupVersion: z.literal("2"),
			MemoryLimit: z.literal(true),
			SwapLimit: z.literal(true),
			CpuCfsQuota: z.literal(true),
			PidsLimit: z.literal(true),
			Runtimes: z.record(z.string(), z.unknown())
		}).parse(JSON.parse(await this.#call([
			"info",
			"--format",
			"{{json .}}"
		])));
		if (!Object.hasOwn(info.Runtimes, "runsc")) throw new RunnerError("PREVIEW_RUNSC_UNAVAILABLE", 503, "not-sent");
		verifyPreviewDockerImage(JSON.parse(await this.#call([
			"image",
			"inspect",
			repository + "@" + r.imageDigest
		])), r, repository);
	}
	async prepare(p) {
		this.#enabled();
		await this.#options.quota.prepare(p.datasetDirectory, p.datasetBytes);
		if (!await this.#options.quota.verify(p.datasetDirectory, p.datasetBytes)) throw new RunnerError("PREVIEW_DATASET_QUOTA_UNVERIFIED", 503);
	}
	async network(p, r) {
		this.#enabled();
		const out = await this.#execute([
			"network",
			"inspect",
			p.networkName
		], 15e3, 256 * 1024);
		if (out.code !== 0) return null;
		const id = verifyPreviewDockerNetwork(JSON.parse(out.stdout), p, r);
		return await this.#options.networkIsolation.verify(id) ? id : null;
	}
	async createNetwork(p, r, authorize) {
		if (!await authorize()) throw new RunnerError("PREVIEW_AUTHORITY_REVOKED", 403, "not-sent");
		const id = dockerObjectId.parse((await this.#call(previewDockerNetworkArguments(p, r))).trim());
		await this.#options.networkIsolation.enforce(id);
		if (await this.network(p, r) !== id) fail("PREVIEW_DOCKER_NETWORK_CHANGED");
		return id;
	}
	async inspect(p, r, networkId, containerId) {
		this.#enabled();
		if (await this.network(p, r) !== networkId) fail("PREVIEW_DOCKER_NETWORK_CHANGED");
		if (!await this.#options.quota.verify(p.datasetDirectory, p.datasetBytes)) fail("PREVIEW_DATASET_QUOTA_UNVERIFIED");
		const out = await this.#execute([
			"inspect",
			"--type",
			"container",
			p.containerName
		], 15e3, 256 * 1024);
		return out.code === 0 ? verifyPreviewDockerContainer(JSON.parse(out.stdout), p, r, networkId, containerId) : null;
	}
	async create(p, r, networkId, authorize) {
		this.#enabled();
		if (!await this.#options.quota.verify(p.datasetDirectory, p.datasetBytes) || await this.network(p, r) !== networkId) fail("PREVIEW_DOCKER_CREATE_UNVERIFIED");
		if (!await authorize()) throw new RunnerError("PREVIEW_AUTHORITY_REVOKED", 403, "not-sent");
		const id = dockerObjectId.parse((await this.#call(previewDockerCreateArguments(p, r, networkId))).trim());
		return this.inspect(p, r, networkId, id);
	}
	async start(p, r, networkId, containerId, authorize) {
		if ((await this.inspect(p, r, networkId, containerId))?.state !== "created") fail("PREVIEW_DOCKER_START_UNVERIFIED");
		if (!await authorize()) throw new RunnerError("PREVIEW_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call(["start", containerId]);
		return this.inspect(p, r, networkId, containerId);
	}
	async stop(p, r, networkId, containerId, authorize) {
		const before = await this.inspect(p, r, networkId, containerId);
		if (before?.state === "exited" || before?.state === "created") return before;
		if (before?.state !== "running") fail("PREVIEW_DOCKER_STOP_UNVERIFIED");
		if (!await authorize()) throw new RunnerError("PREVIEW_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call([
			"stop",
			"--signal=SIGTERM",
			"--timeout=10",
			containerId
		]);
		return this.inspect(p, r, networkId, containerId);
	}
	async containerAbsent(id) {
		dockerObjectId.parse(id);
		return verifyPreviewDockerAbsence(await this.#call([
			"container",
			"ls",
			"--all",
			"--no-trunc",
			"--filter",
			"id=" + id,
			"--format",
			"{{.ID}}"
		]), id);
	}
	async networkAbsent(id) {
		dockerObjectId.parse(id);
		return verifyPreviewDockerAbsence(await this.#call([
			"network",
			"ls",
			"--no-trunc",
			"--filter",
			"id=" + id,
			"--format",
			"{{.ID}}"
		]), id);
	}
	async removeContainer(p, r, networkId, containerId, authorize) {
		const before = await this.inspect(p, r, networkId, containerId);
		if (!before || !["created", "exited"].includes(before.state)) fail("PREVIEW_CLEANUP_CONTAINER_NOT_STOPPED");
		if (!await authorize()) throw new RunnerError("PREVIEW_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call(previewDockerRemovalArguments("CONTAINER_REMOVE", containerId));
	}
	async removeNetwork(p, r, networkId, authorize) {
		const original = JSON.parse(await this.#call([
			"network",
			"inspect",
			networkId
		]));
		if (verifyPreviewDockerNetwork(original, p, r) !== networkId || Object.keys(original[0].Containers ?? {}).length) fail("PREVIEW_CLEANUP_NETWORK_BUSY");
		if (!await authorize()) throw new RunnerError("PREVIEW_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call(previewDockerRemovalArguments("NETWORK_REMOVE", networkId));
	}
};
//#endregion
//#region src/acceptance-abort-finalizer.ts
const options$1 = z.strictObject({
	enabled: z.boolean().default(false),
	runnerId: opaqueKey,
	controllerId: opaqueKey,
	principalId: opaqueKey,
	backendRef: opaqueKey
});
const input = z.strictObject({
	operationId: ids.operation,
	requestHash: sha256
});
/** Trusted composition, deliberately opt-in. Caller supplies only original IDs;
* cleanup comes from Runner SQLite and data proof from the durable file Worker. */
var RunnerAcceptanceAbortFinalizer = class {
	store;
	control;
	data;
	source;
	options;
	constructor(store, control, data, source, raw) {
		this.store = store;
		this.control = control;
		this.data = data;
		this.source = source;
		this.options = options$1.parse(raw);
		if (store.options.runnerId !== this.options.runnerId) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
	}
	get configured() {
		return this.options.enabled && this.data.configured;
	}
	async advance(raw, signal) {
		signal?.throwIfAborted();
		if (!this.configured) throw new RunnerError("ACCEPTANCE_ABORT_FINALIZER_NOT_CONFIGURED", 503, "not-sent");
		const i = input.parse(raw), record = await this.control.request("getAcceptanceAbortDecision", {
			principalId: this.options.principalId,
			preparationOperationId: i.operationId,
			requestHash: i.requestHash
		});
		if (!record) throw new RunnerError("ACCEPTANCE_ABORT_NOT_REQUESTED", 409);
		const q = record.decision.preparation;
		if (q.runnerId !== this.options.runnerId || q.backendRef !== this.options.backendRef || q.backendPrincipalId !== this.options.principalId || datasetHash(canonical(record.decision)) !== record.decisionHash) throw new RunnerError("ACCEPTANCE_ABORT_IDENTITY_CHANGED", 409);
		const bound = {
			principalId: this.options.principalId,
			preparationOperationId: i.operationId,
			requestHash: i.requestHash,
			decisionHash: record.decisionHash
		}, context = await this.control.request("getAcceptanceAbortRecovery", bound);
		if (context.completion) return {
			state: "ABORTED",
			completion: context.completion
		};
		if (q.source && (!this.source?.configured || !context.sourceGate || !context.sourceImageDigest)) return {
			state: "UNKNOWN",
			errorCode: "ACCEPTANCE_SOURCE_RECOVERY_NOT_CONFIGURED"
		};
		const cleanup = await this.store.request("acceptanceAbortGet", {
			controllerId: this.options.controllerId,
			operationId: i.operationId,
			decisionHash: record.decisionHash
		});
		if (canonical(cleanup.record) !== canonical(record) || !cleanup.serviceCleared || !cleanup.networkCleared) return {
			state: "UNKNOWN",
			errorCode: "ACCEPTANCE_ABORT_SERVICE_UNRESOLVED"
		};
		signal?.throwIfAborted();
		const observation = await this.data.advance(i, signal);
		if (observation.state !== "RESTORED_CLOSED") return observation;
		signal?.throwIfAborted();
		const sourceRecovery = q.source ? await this.source.inspect({
			preparation: q,
			decisionHash: record.decisionHash,
			sourceGate: context.sourceGate,
			sourceImageDigest: context.sourceImageDigest,
			dataProof: observation.receipt.proof
		}) : null;
		if (q.source && !sourceRecovery) return {
			state: "UNKNOWN",
			errorCode: "ACCEPTANCE_SOURCE_RECOVERY_UNVERIFIED"
		};
		signal?.throwIfAborted();
		const r = cleanup.reservation, journal = r ? await this.store.request("acceptanceServiceJournal", {
			controllerId: this.options.controllerId,
			reservationId: r.reservationId,
			requestHash: r.requestHash
		}) : null;
		const evidence = acceptanceAbortCompletionEvidence.parse({
			schemaVersion: "devmesh.acceptance-abort-completion.v1",
			operationId: i.operationId,
			requestHash: i.requestHash,
			decisionHash: record.decisionHash,
			service: {
				controllerId: this.options.controllerId,
				cleanupHash: datasetHash(canonical(cleanup)),
				reservationId: r?.reservationId ?? null,
				profileHash: journal?.profileHash ?? null,
				instanceId: r?.instanceId ?? null,
				networkId: journal?.networkId ?? null,
				state: "CLEARED"
			},
			data: observation.receipt,
			sourceGate: context.sourceGate,
			sourceRecovery
		});
		signal?.throwIfAborted();
		return {
			state: "ABORTED",
			completion: await this.control.request("completeAcceptanceAbort", {
				...bound,
				evidence
			})
		};
	}
};
//#endregion
//#region src/acceptance-abort-coordinator.ts
const options = z.strictObject({
	enabled: z.boolean().default(false),
	runnerId: opaqueKey,
	controllerId: opaqueKey,
	principalId: opaqueKey,
	backendRef: opaqueKey
});
/** Compose original cleanup and completion only, never a new abort decision. */
var RunnerAcceptanceAbortCoordinator = class {
	cleanup;
	finalizer;
	options;
	#cleanup;
	#finalize;
	constructor(cleanup, finalizer, raw) {
		this.cleanup = cleanup;
		this.finalizer = finalizer;
		this.options = Object.freeze(options.parse(raw));
		for (const part of [cleanup, finalizer]) for (const key of [
			"runnerId",
			"controllerId",
			"principalId",
			"backendRef"
		]) if (part.options[key] !== this.options[key]) throw new RunnerError("ACCEPTANCE_ABORT_COORDINATOR_IDENTITY_CHANGED", 409);
		this.#cleanup = cleanup.advance.bind(cleanup);
		this.#finalize = finalizer.advance.bind(finalizer);
	}
	get configured() {
		return this.options.enabled && this.cleanup.configured && this.finalizer.configured;
	}
	async advance(input, signal) {
		signal?.throwIfAborted();
		if (!this.configured) throw new RunnerError("ACCEPTANCE_ABORT_COORDINATOR_NOT_CONFIGURED", 503, "not-sent");
		const result = await this.#cleanup(input, signal);
		signal?.throwIfAborted();
		if (!result.serviceCleared || !result.networkCleared) return {
			state: "UNKNOWN",
			errorCode: "ACCEPTANCE_ABORT_SERVICE_UNRESOLVED"
		};
		return this.#finalize(input, signal);
	}
};
//#endregion
//#region src/release-docker.ts
const hash$1 = (v) => createHash("sha256").update(canonical(v)).digest("hex");
const subject = (p, r) => ({
	imageDigest: r.image.imageDigest,
	imageIdentity: r.image,
	readonlyDataset: false,
	runtimeRoot: "/tmp/devmesh-runtime",
	errorPrefix: "RELEASE_SERVICE",
	labels: p ? {
		"devmesh.runner": r.runnerId,
		"devmesh.purpose": "RELEASE",
		"devmesh.operation": r.operationId,
		"devmesh.release": r.releaseId,
		"devmesh.dataset": r.target.datasetId,
		"devmesh.reservation": p.reservationId,
		"devmesh.request": p.requestHash,
		"devmesh.profile": hash$1(p)
	} : {}
});
const binding = (raw, input) => {
	const p = releaseServiceProfile.parse(raw), r = releaseServiceRequest.parse(input);
	if (p.requestHash !== hash$1(r)) throw new RunnerError("RELEASE_SERVICE_IDENTITY_CHANGED", 409);
	return {
		p,
		r: r.promotion.preparation
	};
};
function releaseDockerNetworkArguments(raw, input) {
	const { p, r } = binding(raw, input);
	return serviceDockerNetworkArguments(p, subject(p, r));
}
function releaseDockerCreateArguments(raw, input, networkId) {
	const { p, r } = binding(raw, input);
	return serviceDockerCreateArguments(p, subject(p, r), networkId);
}
function verifyReleaseDockerImage(value, r, repository) {
	return verifyServiceDockerImage(value, subject(null, r), repository);
}
function verifyReleaseDockerNetwork(value, raw, input) {
	const { p, r } = binding(raw, input);
	return verifyServiceDockerNetwork(value, p, subject(p, r));
}
function verifyReleaseDockerContainer(value, raw, input, networkId, containerId) {
	const { p, r } = binding(raw, input);
	return verifyServiceDockerContainer(value, p, subject(p, r), networkId, containerId);
}
/** Explicit Linux driver. Every physical observation rechecks the full original
* profile. A physical write guard is required before writable create/start. */
var DockerReleaseServiceDriver = class {
	configured;
	#execute;
	#options;
	constructor(options, executor) {
		if (!isAbsolute(options.dockerPath) || !options.socketPath.startsWith("/") || /[\0\r\n]/.test(options.socketPath)) throw new RunnerError("RELEASE_SERVICE_DOCKER_CONFIG_INVALID", 422);
		this.#options = { ...options };
		this.configured = options.enabled === true && process.platform === "linux" && !!options.quota && !!options.networkIsolation && !!options.guard?.configured;
		this.#execute = executor ?? ((args, timeoutMs, maximumBytes) => new Promise((resolve, reject) => {
			const child = spawn(options.dockerPath, [
				"--host",
				"unix://" + options.socketPath,
				...args
			], {
				shell: false,
				windowsHide: true,
				stdio: [
					"ignore",
					"pipe",
					"ignore"
				],
				env: {
					PATH: "/usr/local/bin:/usr/bin:/bin",
					LANG: "C.UTF-8"
				}
			});
			let count = 0;
			const chunks = [];
			const timer = setTimeout(() => {
				child.kill("SIGKILL");
				reject(new RunnerError("RELEASE_SERVICE_DOCKER_UNKNOWN", 503, "unknown"));
			}, timeoutMs);
			timer.unref();
			child.stdout.on("data", (b) => {
				count += b.length;
				if (count > maximumBytes) {
					child.kill("SIGKILL");
					reject(new RunnerError("RELEASE_SERVICE_DOCKER_OUTPUT_LIMIT", 503, "unknown"));
				} else chunks.push(b);
			});
			child.once("error", () => {
				clearTimeout(timer);
				reject(new RunnerError("RELEASE_SERVICE_DOCKER_UNAVAILABLE", 503, "unknown"));
			});
			child.once("close", (code) => {
				clearTimeout(timer);
				resolve({
					code: code ?? -1,
					stdout: Buffer.concat(chunks).toString("utf8")
				});
			});
		}));
	}
	#enabled() {
		if (!this.configured || !this.#options.guard?.configured) throw new RunnerError("RELEASE_SERVICE_DOCKER_NOT_CONFIGURED", 503, "not-sent");
	}
	async #call(args) {
		this.#enabled();
		const r = await this.#execute(args, 15e3, 256 * 1024);
		if (r.code !== 0) throw new RunnerError("RELEASE_SERVICE_DOCKER_UNKNOWN", 503, "unknown");
		return r.stdout;
	}
	async #guard(p, r) {
		const proof = await this.inspectGuard(p, r, this.#options.controllerId);
		if (!proof) throw new RunnerError("RELEASE_SERVICE_GUARD_UNVERIFIED", 409);
		return proof;
	}
	#verifyGuard(raw, p, r, controllerId) {
		const g = releaseServiceGuardProof.parse(raw), q = r.promotion.preparation;
		binding(p, r);
		if (controllerId !== this.#options.controllerId || g.releaseId !== q.releaseId || g.runnerId !== q.runnerId || g.controllerId !== controllerId || g.serviceRequestHash !== p.requestHash || g.reservationId !== p.reservationId || g.profileHash !== hash$1(p) || g.datasetId !== q.target.datasetId || g.targetProofHash !== p.fenceProofHash || g.gateBindingHash !== p.gateBindingHash) throw new RunnerError("RELEASE_SERVICE_GUARD_CHANGED", 409);
		return g;
	}
	async enforceGuard(p, r, controllerId, authorize) {
		this.#enabled();
		binding(p, r);
		return this.#verifyGuard(await this.#options.guard.enforce(p, r, controllerId, authorize), p, r, controllerId);
	}
	async inspectGuard(p, r, controllerId) {
		this.#enabled();
		binding(p, r);
		const g = await this.#options.guard.inspect(p, r, controllerId);
		return g ? this.#verifyGuard(g, p, r, controllerId) : null;
	}
	async probe(r, repository) {
		this.#enabled();
		const info = z.object({
			OSType: z.literal("linux"),
			CgroupVersion: z.literal("2"),
			MemoryLimit: z.literal(true),
			SwapLimit: z.literal(true),
			CpuCfsQuota: z.literal(true),
			PidsLimit: z.literal(true),
			Runtimes: z.record(z.string(), z.unknown())
		}).parse(JSON.parse(await this.#call([
			"info",
			"--format",
			"{{json .}}"
		])));
		if (!Object.hasOwn(info.Runtimes, "runsc")) throw new RunnerError("RELEASE_SERVICE_RUNSC_UNAVAILABLE", 503, "not-sent");
		verifyReleaseDockerImage(JSON.parse(await this.#call([
			"image",
			"inspect",
			repository + "@" + r.image.imageDigest
		])), r, repository);
	}
	async prepared(p, r) {
		this.#enabled();
		binding(p, r);
		return this.#options.quota.verify(p.datasetDirectory, p.datasetBytes);
	}
	async prepare(p, r, authorize) {
		this.#enabled();
		binding(p, r);
		if (!await authorize()) throw new RunnerError("RELEASE_SERVICE_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#options.quota.prepare(p.datasetDirectory, p.datasetBytes);
		if (!await this.#options.quota.verify(p.datasetDirectory, p.datasetBytes)) throw new RunnerError("RELEASE_SERVICE_QUOTA_UNVERIFIED", 503);
	}
	async network(p, r) {
		this.#enabled();
		binding(p, r);
		const out = await this.#execute([
			"network",
			"inspect",
			p.networkName
		], 15e3, 256 * 1024);
		if (out.code !== 0) return null;
		const id = verifyReleaseDockerNetwork(JSON.parse(out.stdout), p, r);
		return await this.#options.networkIsolation.verify(id) ? id : null;
	}
	async createNetwork(p, r, authorize) {
		this.#enabled();
		binding(p, r);
		if (!await authorize()) throw new RunnerError("RELEASE_SERVICE_AUTHORITY_REVOKED", 403, "not-sent");
		const id = dockerObjectId.parse((await this.#call(releaseDockerNetworkArguments(p, r))).trim());
		await this.#options.networkIsolation.enforce(id);
		if (await this.network(p, r) !== id) throw new RunnerError("RELEASE_SERVICE_DOCKER_NETWORK_CHANGED", 409);
		return id;
	}
	async inspect(p, r, networkId, containerId) {
		await this.#guard(p, r);
		return this.#inspect(p, r, networkId, containerId);
	}
	async #inspect(p, r, networkId, containerId) {
		this.#enabled();
		if (await this.network(p, r) !== networkId || !await this.#options.quota.verify(p.datasetDirectory, p.datasetBytes)) throw new RunnerError("RELEASE_SERVICE_DOCKER_PROFILE_UNVERIFIED", 409);
		const out = await this.#execute([
			"inspect",
			"--type",
			"container",
			p.containerName
		], 15e3, 256 * 1024);
		return out.code === 0 ? verifyReleaseDockerContainer(JSON.parse(out.stdout), p, r, networkId, containerId) : null;
	}
	async inspectRetired(p, r, networkId, containerId) {
		return this.#inspect(p, r, networkId, containerId);
	}
	async create(p, r, networkId, authorize) {
		this.#enabled();
		await this.#guard(p, r);
		if (!await this.#options.quota.verify(p.datasetDirectory, p.datasetBytes) || await this.network(p, r) !== networkId) throw new RunnerError("RELEASE_SERVICE_DOCKER_CREATE_UNVERIFIED", 409);
		if (!await authorize()) throw new RunnerError("RELEASE_SERVICE_AUTHORITY_REVOKED", 403, "not-sent");
		const id = dockerObjectId.parse((await this.#call(releaseDockerCreateArguments(p, r, networkId))).trim());
		return this.inspect(p, r, networkId, id);
	}
	async start(p, r, networkId, containerId, authorize) {
		const before = await this.#inspect(p, r, networkId, containerId);
		await this.#guard(p, r);
		if (before?.state !== "created") throw new RunnerError("RELEASE_SERVICE_DOCKER_START_UNVERIFIED", 409);
		if (!await authorize()) throw new RunnerError("RELEASE_SERVICE_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call(["start", containerId]);
		return this.inspect(p, r, networkId, containerId);
	}
	async stop(p, r, networkId, containerId, authorize) {
		const before = await this.#inspect(p, r, networkId, containerId);
		if (before?.state === "created" || before?.state === "exited") return before;
		if (before?.state !== "running") throw new RunnerError("RELEASE_SERVICE_STOP_UNVERIFIED", 409);
		if (!await authorize()) throw new RunnerError("RELEASE_SERVICE_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call([
			"stop",
			"--signal=SIGTERM",
			"--timeout=10",
			containerId
		]);
		return this.#inspect(p, r, networkId, containerId);
	}
	async containerAbsent(id) {
		dockerObjectId.parse(id);
		return verifyServiceDockerAbsence(await this.#call([
			"container",
			"ls",
			"--all",
			"--no-trunc",
			"--filter",
			"id=" + id,
			"--format",
			"{{.ID}}"
		]), id, "RELEASE_SERVICE_QUERY_UNVERIFIED");
	}
	async networkAbsent(id) {
		dockerObjectId.parse(id);
		return verifyServiceDockerAbsence(await this.#call([
			"network",
			"ls",
			"--no-trunc",
			"--filter",
			"id=" + id,
			"--format",
			"{{.ID}}"
		]), id, "RELEASE_SERVICE_QUERY_UNVERIFIED");
	}
	async removeContainer(p, r, networkId, containerId, authorize) {
		const before = await this.#inspect(p, r, networkId, containerId);
		if (!before || !["created", "exited"].includes(before.state)) throw new RunnerError("RELEASE_SERVICE_CONTAINER_NOT_STOPPED", 409);
		if (!await authorize()) throw new RunnerError("RELEASE_SERVICE_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call(serviceDockerRemovalArguments("CONTAINER_REMOVE", containerId));
	}
	async removeNetwork(p, r, networkId, authorize) {
		const original = JSON.parse(await this.#call([
			"network",
			"inspect",
			networkId
		]));
		if (verifyReleaseDockerNetwork(original, p, r) !== networkId || Object.keys(original[0].Containers ?? {}).length) throw new RunnerError("RELEASE_SERVICE_NETWORK_BUSY", 409);
		if (!await authorize()) throw new RunnerError("RELEASE_SERVICE_AUTHORITY_REVOKED", 403, "not-sent");
		await this.#call(serviceDockerRemovalArguments("NETWORK_REMOVE", networkId));
	}
};
//#endregion
//#region src/release-service-backend.ts
const optionsSchema = z.strictObject({
	enabled: z.boolean().default(false),
	runnerId: opaqueKey,
	controllerId: opaqueKey,
	backendRef: opaqueKey,
	principalId: opaqueKey,
	repository: previewRepository,
	capacity: runnerCapacity,
	resourceLimits: previewResourceLimits
});
const hash = (v) => createHash("sha256").update(canonical(v)).digest("hex");
const time = () => (/* @__PURE__ */ new Date()).toISOString();
/** Explicit trusted composition. Query recovery never begins another physical
* stage. Provider implementations must enforce physical fencing on every write. */
var RunnerReleaseServiceBackend = class {
	store;
	control;
	retirement;
	authority;
	driver;
	routes;
	options;
	constructor(store, control, retirement, authority, driver, routes, options) {
		this.store = store;
		this.control = control;
		this.retirement = retirement;
		this.authority = authority;
		this.driver = driver;
		this.routes = routes;
		this.options = optionsSchema.parse(options);
		const o = this.options, r = retirement.options;
		if (store.options.runnerId !== o.runnerId || retirement.store !== store || retirement.control !== control || r.runnerId !== o.runnerId || r.controllerId !== o.controllerId || r.backendRef !== o.backendRef || r.principalId !== o.principalId) throw new RunnerError("RELEASE_SERVICE_COMPOSITION_CHANGED", 409);
	}
	get configured() {
		return this.options.enabled && this.retirement.configured && this.authority.configured && this.driver.configured && this.routes.configured;
	}
	#enabled() {
		if (!this.configured) throw new RunnerError("RELEASE_SERVICE_NOT_CONFIGURED", 503, "not-sent");
	}
	#unknown(errorCode = "RELEASE_SERVICE_ORIGINAL_UNVERIFIED") {
		return {
			state: "UNKNOWN",
			errorCode,
			checkedAt: time()
		};
	}
	#bound(p) {
		if (!p.basis) throw new RunnerError("RELEASE_SERVICE_NOT_DISPATCHED", 409);
		const old = {
			schemaVersion: "devmesh.release-retirement.v1",
			promotion: p.request,
			promotionRequestHash: p.requestHash,
			gates: p.basis
		};
		const request = releaseServiceRequest.parse({
			...old,
			schemaVersion: "devmesh.release-service-start.v1",
			purpose: "RELEASE",
			retirementRequestHash: hash(old)
		});
		return {
			request,
			bound: {
				controllerId: this.options.controllerId,
				releaseId: p.releaseId,
				requestHash: hash(request)
			}
		};
	}
	async #current(p, authorize, continuation = false) {
		const q = p.request.preparation, o = this.options;
		if (q.runnerId !== o.runnerId || q.backendRef !== o.backendRef || q.backendPrincipalId !== o.principalId || q.releaseId !== p.releaseId || hash(p.request) !== p.requestHash) throw new RunnerError("RELEASE_SERVICE_IDENTITY_CHANGED", 409);
		const c = await this.control.request("getReleasePublication", {
			principalId: o.principalId,
			releaseId: p.releaseId
		});
		if (c.requestHash !== p.requestHash || canonical(c.request) !== canonical(p.request) || canonical(c.basis) !== canonical(p.basis)) throw new RunnerError("RELEASE_SERVICE_IDENTITY_CHANGED", 409);
		if (authorize && !(await this.control.request(continuation ? "verifyReleasePublicationContinuation" : "verifyReleasePublication", {
			principalId: o.principalId,
			releaseId: p.releaseId,
			requestHash: p.requestHash
		})).allowed) throw new RunnerError("RELEASE_SERVICE_AUTHORITY_CLOSED", 409);
	}
	async preflight(p) {
		this.#enabled();
		await this.#current(p, false);
		await this.authority.preflight(p);
		await this.routes.preflight(p);
		await this.store.request("capacityConfigure", this.options.capacity);
		await this.driver.probe(p.request.preparation, this.options.repository);
	}
	async #allowed(p, j, authorize, continuation = false) {
		try {
			await this.#current(p, true, continuation);
			if (!await authorize()) return false;
			const a = j.actions.find((a) => a.request.kind === "ARM_FENCES" && a.state === "OBSERVED");
			if (a?.observation?.kind === "ARM_FENCES" && canonical(await this.authority.inspect(j.retirement)) !== canonical(a.observation.proof)) return false;
			if (j.actions.some((a) => a.request.kind === "PROFILE_PREPARE" && a.state === "OBSERVED") && !await this.driver.prepared(j.profile, j.request)) return false;
			const g = j.actions.find((a) => a.request.kind === "GUARD_ENFORCE" && a.state === "OBSERVED");
			if (g?.observation?.kind === "GUARD_ENFORCE" && canonical(await this.driver.inspectGuard(j.profile, j.request, j.controllerId)) !== canonical(g.observation.proof)) return false;
			return await authorize();
		} catch {
			return false;
		}
	}
	async #step(p, j, kind, authorize, continuation = false) {
		if (!await this.#allowed(p, j, authorize, continuation)) throw new RunnerError("RELEASE_SERVICE_AUTHORITY_CLOSED", 409);
		const { bound } = this.#bound(p), g = await this.store.request("releaseServiceActionBegin", {
			...bound,
			kind
		});
		if (!g.dispatch && !continuation) return false;
		const allowed = async () => await this.#allowed(p, j, authorize, continuation) && (await this.store.request("releaseServiceActionAuthorized", {
			...bound,
			kind,
			actionRequestHash: g.action.requestHash
		})).allowed;
		j = await this.#observe(p, j, g.action, g.dispatch, allowed);
		return j.actions.some((a) => a.request.kind === kind && a.state === "OBSERVED");
	}
	async publish(p, authorize) {
		return this.#advance(p, authorize, false);
	}
	async resume(p, authorize) {
		return this.#advance(p, authorize, true);
	}
	async #advance(p, authorize, continuation) {
		if (p.state !== "SENT" && !(continuation && p.state === "UNKNOWN")) return this.inspect(p);
		await this.preflight(p);
		try {
			await this.#current(p, true, continuation);
			if (!(continuation ? await this.retirement.resume(p, authorize) : await this.retirement.retire(p, authorize)).networkCleared) return this.#unknown("RELEASE_SERVICE_RETIREMENT_UNVERIFIED");
			const { request, bound } = this.#bound(p);
			if (!await authorize()) return this.#unknown("RELEASE_SERVICE_AUTHORITY_CLOSED");
			const grant = await this.store.request("releaseServiceEnroll", {
				controllerId: bound.controllerId,
				request,
				requestHash: bound.requestHash,
				resourceLimits: this.options.resourceLimits
			});
			if (!grant.dispatch && !continuation) return this.inspect(p);
			let j = grant.journal;
			for (const kind of ["ARM_FENCES", ...j.source ? [
				"SOURCE_STOP",
				"SOURCE_CONTAINER_REMOVE",
				"SOURCE_NETWORK_REMOVE"
			] : []]) {
				if (!await this.#step(p, j, kind, authorize, continuation)) return this.inspect(p);
				j = await this.store.request("releaseServiceGet", bound);
			}
			if (!await this.#allowed(p, j, authorize, continuation)) return this.#unknown("RELEASE_SERVICE_AUTHORITY_CLOSED");
			j = await this.store.request("releaseServiceReserve", {
				...bound,
				capacity: this.options.capacity
			});
			const r = j.reservation, f = j.actions.find((a) => a.request.kind === "ARM_FENCES").observation;
			if (f?.kind !== "ARM_FENCES") return this.#unknown();
			const profile = releaseServiceProfile.parse({
				schemaVersion: "devmesh.release-service-profile.v1",
				purpose: "RELEASE",
				accessMode: "READ_WRITE",
				writeAdmission: "CONTROL_GATE_FENCED",
				reservationId: r.reservationId,
				requestHash: bound.requestHash,
				repository: this.options.repository,
				datasetDirectory: j.retirement.original.profile.datasetDirectory,
				datasetBytes: j.retirement.original.profile.datasetBytes,
				resourceLimits: r.resourceLimits,
				...releaseServiceNames(r.reservationId),
				fenceProofHash: f.proof.target.proofHash,
				gateBindingHash: releaseServiceGateBinding(request)
			});
			j = await this.store.request("releaseServiceProfilePrepare", {
				...bound,
				profile
			});
			for (const kind of [
				"PROFILE_PREPARE",
				"GUARD_ENFORCE",
				"NETWORK_CREATE",
				"CREATE",
				"START"
			]) {
				if (!await this.#step(p, j, kind, authorize, continuation)) return this.inspect(p);
				j = await this.store.request("releaseServiceGet", bound);
			}
			j = await this.#refresh(p, j);
			if (!await this.#allowed(p, j, authorize, continuation) || j.reservation?.fact?.state !== "HEALTHY") return this.#unknown("RELEASE_SERVICE_UNHEALTHY");
			j = await this.store.request("releaseServiceOwn", bound);
			if (!await this.#step(p, j, "ROUTE_BIND", authorize, continuation)) return this.inspect(p);
			await this.store.request("releaseServicePrepareProof", bound);
			return this.inspect(p);
		} catch (e) {
			return this.#unknown(e instanceof RunnerError ? e.code : "RELEASE_SERVICE_OUTCOME_UNKNOWN");
		}
	}
	/** Query original actions only. No new enrollment/reservation/profile, guard
	* enforcement, ownership claim, create/start, route bind or physical handoff. */
	async inspect(p) {
		this.#enabled();
		try {
			await this.#current(p, false);
			const { bound } = this.#bound(p);
			let j = await this.store.request("releaseServiceGet", bound);
			for (const a of j.actions) {
				if (a.state === "OBSERVED") continue;
				j = await this.#observe(p, j, a, false, async () => false);
			}
			if (!j.reservation || j.reservation.releasedAt !== null || !j.profile || !j.containerId || !j.networkId || !await this.driver.prepared(j.profile, j.request)) return this.#unknown();
			j = await this.#refresh(p, j);
			if (j.reservation?.fact?.state !== "HEALTHY" || !j.reservation.claimHash || !j.actions.some((a) => a.request.kind === "ROUTE_BIND" && a.state === "OBSERVED")) return this.#unknown("RELEASE_SERVICE_UNHEALTHY");
			j = await this.store.request("releaseServicePrepareProof", bound);
			const proof = j.proof, arm = j.actions.find((a) => a.request.kind === "ARM_FENCES").observation, guard = j.actions.find((a) => a.request.kind === "GUARD_ENFORCE").observation;
			if (arm?.kind !== "ARM_FENCES" || guard?.kind !== "GUARD_ENFORCE" || canonical(await this.authority.inspect(j.retirement)) !== canonical(arm.proof) || canonical(await this.driver.inspectGuard(j.profile, j.request, j.controllerId)) !== canonical(guard.proof) || canonical(await this.routes.inspect(j)) !== canonical(proof.route)) return this.#unknown("RELEASE_SERVICE_CURRENT_CHANGED");
			if (!await this.retirement.driver.containerAbsent(proof.readonlyRetirement.instanceId) || !await this.retirement.driver.networkAbsent(proof.readonlyRetirement.networkId)) return this.#unknown("RELEASE_SERVICE_RETIREMENT_CHANGED");
			if (j.source && (!await this.driver.containerAbsent(j.source.containerId) || !await this.driver.networkAbsent(j.source.networkId))) return this.#unknown("RELEASE_SERVICE_SOURCE_NOT_CLEARED");
			const c = proof.service.claim, r = proof.route;
			return releasePublicationObservation.parse({
				state: "PUBLISHED",
				proof,
				checkedAt: time(),
				current: {
					service: {
						instanceId: c.instanceId,
						datasetId: c.datasetId,
						imageDigest: c.imageDigest,
						profileHash: c.profileHash,
						claimHash: proof.service.claimHash,
						endpoint: proof.service.endpoint,
						accessMode: c.accessMode,
						custodyState: c.custodyState,
						writeAdmission: c.writeAdmission,
						state: "HEALTHY"
					},
					route: {
						routeId: r.routeId,
						routeHash: proof.routeHash,
						generation: r.generation,
						instanceId: r.instanceId,
						state: "BOUND"
					},
					fences: {
						targetProofHash: proof.target.proofHash,
						sourceProofHash: proof.source?.proofHash ?? null,
						revocationProofHash: proof.revocation.proofHash,
						targetState: "ARMED",
						targetWriteState: "CONTROL_CLOSED",
						sourceWriteState: "CLOSED"
					}
				}
			});
		} catch (e) {
			return this.#unknown(e instanceof RunnerError ? e.code : "RELEASE_SERVICE_OUTCOME_UNKNOWN");
		}
	}
	async #refresh(p, j) {
		if (!j.profile || !j.networkId || !j.containerId) return j;
		const f = await this.driver.inspect(j.profile, j.request, j.networkId, j.containerId);
		if (!f || f.containerId !== j.containerId || f.networkId !== j.networkId) throw new RunnerError("RELEASE_SERVICE_OBJECT_CHANGED", 409);
		const healthy = f.state === "running" && f.endpoint ? await probePreviewHealth(f.endpoint) : false, q = p.request.preparation;
		return this.store.request("releaseServiceRecord", {
			...this.#bound(p).bound,
			expectedRevision: j.reservation.revision,
			fact: {
				releaseId: p.releaseId,
				datasetId: q.target.datasetId,
				imageDigest: q.image.imageDigest,
				state: f.state === "running" ? healthy ? "HEALTHY" : "UNHEALTHY" : f.state === "created" ? "CREATED" : f.state === "exited" ? "EXITED" : "UNKNOWN",
				instanceId: f.state === "unknown" ? null : f.containerId,
				endpoint: f.state === "running" ? f.endpoint : null,
				checkedAt: time()
			}
		});
	}
	async #observe(p, j, a, dispatch, authorize) {
		if (a.state === "OBSERVED") return j;
		const { bound } = this.#bound(p), kind = a.request.kind;
		if (kind === "PROFILE_PREPARE") {
			if (dispatch && j.profilePreparation === "EXECUTE_ONCE") await this.driver.prepare(j.profile, j.request, authorize);
			return await this.driver.prepared(j.profile, j.request) ? this.store.request("releaseServiceActionObserve", {
				...bound,
				kind,
				actionRequestHash: a.requestHash,
				observation: {
					kind,
					profileHash: j.profileHash,
					checkedAt: time()
				}
			}) : j;
		}
		if (kind === "ARM_FENCES") {
			const proof = dispatch ? await this.authority.handoff(j.retirement, authorize) : await this.authority.inspect(j.retirement);
			return proof ? this.store.request("releaseServiceActionObserve", {
				...bound,
				kind,
				actionRequestHash: a.requestHash,
				observation: {
					kind,
					proof,
					checkedAt: time()
				}
			}) : j;
		}
		if (kind === "GUARD_ENFORCE") {
			const proof = dispatch ? await this.driver.enforceGuard(j.profile, j.request, j.controllerId, authorize) : await this.driver.inspectGuard(j.profile, j.request, j.controllerId);
			return proof ? this.store.request("releaseServiceActionObserve", {
				...bound,
				kind,
				actionRequestHash: a.requestHash,
				observation: {
					kind,
					proof,
					checkedAt: time()
				}
			}) : j;
		}
		if (kind === "ROUTE_BIND") {
			const route = dispatch ? await this.routes.bind(j, authorize) : await this.routes.inspect(j);
			return route ? this.store.request("releaseServiceActionObserve", {
				...bound,
				kind,
				actionRequestHash: a.requestHash,
				observation: {
					kind,
					route,
					routeHash: hash(route),
					checkedAt: time()
				}
			}) : j;
		}
		if (kind === "SOURCE_STOP" || kind === "SOURCE_CONTAINER_REMOVE" || kind === "SOURCE_NETWORK_REMOVE") {
			const s = j.source;
			if (kind === "SOURCE_STOP") {
				const f = dispatch ? await this.driver.stop(s.profile, s.request, s.networkId, s.containerId, authorize) : await this.driver.inspectRetired(s.profile, s.request, s.networkId, s.containerId);
				if (!f || f.containerId !== s.containerId || f.networkId !== s.networkId || !["created", "exited"].includes(f.state)) return j;
				return this.store.request("releaseServiceActionObserve", {
					...bound,
					kind,
					actionRequestHash: a.requestHash,
					observation: {
						kind,
						objectId: f.containerId,
						state: f.state === "created" ? "CREATED" : "EXITED",
						checkedAt: time()
					}
				});
			}
			if (dispatch) if (kind === "SOURCE_CONTAINER_REMOVE") await this.driver.removeContainer(s.profile, s.request, s.networkId, s.containerId, authorize);
			else await this.driver.removeNetwork(s.profile, s.request, s.networkId, authorize);
			const id = kind === "SOURCE_CONTAINER_REMOVE" ? s.containerId : s.networkId;
			return (kind === "SOURCE_CONTAINER_REMOVE" ? await this.driver.containerAbsent(id) : await this.driver.networkAbsent(id)) ? this.store.request("releaseServiceActionObserve", {
				...bound,
				kind,
				actionRequestHash: a.requestHash,
				observation: {
					kind,
					objectId: id,
					absenceVerified: true,
					checkedAt: time()
				}
			}) : j;
		}
		if (kind === "NETWORK_CREATE") {
			const id = dispatch ? await this.driver.createNetwork(j.profile, j.request, authorize) : await this.driver.network(j.profile, j.request);
			return id ? this.store.request("releaseServiceActionObserve", {
				...bound,
				kind,
				actionRequestHash: a.requestHash,
				observation: {
					kind,
					objectId: id,
					state: "CREATED",
					checkedAt: time()
				}
			}) : j;
		}
		const f = dispatch ? kind === "CREATE" ? await this.driver.create(j.profile, j.request, j.networkId, authorize) : await this.driver.start(j.profile, j.request, j.networkId, j.containerId, authorize) : await this.driver.inspect(j.profile, j.request, j.networkId, j.containerId);
		if (!f || f.networkId !== j.networkId || kind === "CREATE" && f.state !== "created" || kind === "START" && !["running", "exited"].includes(f.state)) return j;
		return this.store.request("releaseServiceActionObserve", {
			...bound,
			kind,
			actionRequestHash: a.requestHash,
			observation: {
				kind,
				objectId: f.containerId,
				state: f.state === "created" ? "CREATED" : f.state === "running" ? "RUNNING" : "EXITED",
				checkedAt: time()
			}
		});
	}
};
//#endregion
//#region src/release-http.ts
const sha = (v) => createHash("sha256").update(v).digest("hex");
const allowedHeaders = /* @__PURE__ */ new Set([
	"accept",
	"accept-language",
	"content-type",
	"if-match",
	"if-none-match",
	"range",
	"idempotency-key"
]);
/** Explicit Runner-local composition. A saved publication is identity, never live health. */
var RunnerReleaseHttpTransport = class {
	backend;
	maximumResponseBytes;
	timeoutMs;
	constructor(backend, maximumResponseBytes = 4 * 1024 * 1024, timeoutMs = 15e3) {
		this.backend = backend;
		this.maximumResponseBytes = maximumResponseBytes;
		this.timeoutMs = timeoutMs;
		if (!Number.isSafeInteger(maximumResponseBytes) || maximumResponseBytes < 1024 || maximumResponseBytes > 16 * 1024 * 1024 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3e4) throw new RunnerError("RELEASE_HTTP_LIMIT_INVALID", 422, "not-sent");
	}
	get configured() {
		return this.backend.configured;
	}
	async check(target) {
		try {
			const t = releaseAccessTarget.parse(target), o = this.backend.options;
			if (!this.configured || t.runnerId !== o.runnerId || t.controllerId !== o.controllerId || t.backendRef !== o.backendRef) throw new Error("identity");
			const started = Date.now(), p = await this.backend.control.request("getReleasePublication", {
				principalId: o.principalId,
				releaseId: t.releaseId
			});
			if (canonical(releaseTargetForPublication(p)) !== canonical(t)) throw new Error("publication");
			const observed = await this.backend.inspect(p);
			if (observed.state !== "PUBLISHED" || sha(canonical(observed.proof)) !== t.publicationProofHash || observed.current.service.state !== "HEALTHY" || observed.current.service.instanceId !== t.instanceId || observed.current.service.profileHash !== t.profileHash || observed.current.service.claimHash !== t.claimHash || canonical(observed.current.service.endpoint) !== canonical(t.endpoint) || observed.current.route.routeHash !== t.routeHash || observed.current.route.generation !== t.routeGeneration) throw new Error("health");
			if (Date.parse(observed.checkedAt) < started || Date.parse(observed.checkedAt) > Date.now()) throw new Error("stale health");
			const j = await this.backend.store.request("releaseServiceGet", {
				controllerId: o.controllerId,
				releaseId: t.releaseId,
				requestHash: t.serviceRequestHash
			}), r = j.reservation;
			if (!r || r.state !== "ACTIVE" || r.releasedAt !== null || r.reservationId !== t.reservationId || r.claimHash !== t.claimHash || j.profileHash !== t.profileHash || j.proofHash !== t.publicationProofHash || j.containerId !== t.instanceId || j.networkId !== t.networkId || r.fact?.state !== "HEALTHY" || r.fact.instanceId !== t.instanceId || canonical(r.fact.endpoint) !== canonical(t.endpoint)) throw new Error("journal");
			return { checkedAt: observed.checkedAt };
		} catch {
			throw new RunnerError("RELEASE_HTTP_ORIGINAL_UNVERIFIED", 503, "not-sent");
		}
	}
	async forward(input) {
		const { record, headers, body, signal } = input, t = record.target;
		let request$1;
		try {
			request$1 = releaseAccessHttpRequest.parse(record.request);
			if (record.state !== "DISPATCHED" || record.requestHash !== releaseAccessRequestHash(record) || request$1.headersSha256 !== sha(canonical(headers)) || request$1.bodySha256 !== sha(body) || body.byteLength > 1024 * 1024) throw new Error("request");
			for (const [name, value] of Object.entries(headers)) if (!allowedHeaders.has(name) || /[\r\n\0]/.test(value) || value.length > 8192) throw new Error("headers");
			if (signal.aborted) throw new Error("aborted");
			await this.check(t);
			if (signal.aborted || !await input.authorize()) throw new Error("authorization");
		} catch {
			throw new RunnerError("RELEASE_HTTP_NOT_SENT", 503, "not-sent");
		}
		return new Promise((resolve, reject) => {
			let settled = false;
			const fail = () => {
				if (!settled) {
					settled = true;
					reject(new RunnerError("RELEASE_HTTP_OUTCOME_UNKNOWN", 502, "unknown"));
				}
			};
			const req = request({
				host: "127.0.0.1",
				port: t.endpoint.port,
				method: request$1.method,
				path: request$1.path,
				agent: false,
				signal,
				headers: {
					...headers,
					host: `127.0.0.1:${t.endpoint.port}`,
					"content-length": body.byteLength
				}
			}, (res) => {
				if (!res.statusCode || res.statusCode < 200 || res.statusCode > 599) {
					res.destroy();
					fail();
					return;
				}
				const chunks = [];
				let size = 0;
				res.on("data", (chunk) => {
					size += chunk.length;
					if (size > this.maximumResponseBytes) {
						res.destroy();
						req.destroy();
						fail();
					} else chunks.push(chunk);
				});
				res.on("error", fail);
				res.on("aborted", fail);
				res.on("end", () => {
					if (settled) return;
					if (!res.complete) {
						fail();
						return;
					}
					settled = true;
					const responseHeaders = {};
					for (const [name, value] of Object.entries(res.headers)) if (value !== void 0) responseHeaders[name] = value;
					resolve({
						status: res.statusCode,
						headers: responseHeaders,
						body: Buffer.concat(chunks)
					});
				});
			});
			req.on("error", fail);
			req.on("upgrade", (_res, socket) => {
				socket.destroy();
				fail();
			});
			const timer = setTimeout(() => {
				req.destroy();
				fail();
			}, this.timeoutMs);
			timer.unref();
			req.on("close", () => clearTimeout(timer));
			req.end(body);
		});
	}
};
//#endregion
export { DockerAcceptanceServiceDriver, DockerBackend, DockerPreviewDriver, DockerReleaseServiceDriver, LocalSqliteAcceptanceDatasetBackend, LocalSqliteDatasetBackend, RunnerAcceptanceAbortBackend, RunnerAcceptanceAbortCoordinator, RunnerAcceptanceAbortFinalizer, RunnerAcceptanceDatasetAbortBackend, RunnerAcceptancePreparationBackend, RunnerClient, RunnerDatasetPaths, RunnerError, RunnerManager, RunnerMaterials, RunnerPolicy, RunnerPreviewBackend, RunnerPreviewHttpTransport, RunnerPreviewWatchdog, RunnerReleaseHttpTransport, RunnerReleaseRetirementBackend, RunnerReleaseServiceBackend, RunnerStore, acceptanceAbortActionRequest, acceptanceAbortObservation, acceptanceDatasetAbortJournal, acceptanceDatasetAbortProof, acceptanceDatasetAbortReceipt, acceptanceDatasetAbortRequest, acceptanceDockerCreateArguments, acceptanceDockerNetworkArguments, acceptanceServiceFact, acceptanceServiceNames, acceptanceServiceProfile, acceptanceServiceRequest, acceptanceServiceReservation, acquireWorkspaceFence, attemptKey, commandSpec, imageDigest, openRunnerStorage, openRunnerStore, ownerKey, previewCleanupKind, previewCleanupObservation, previewCleanupRequest, previewContainerNames, previewContainerProfile, previewDockerCreateArguments, previewDockerNetworkArguments, previewDockerRemovalArguments, previewReleaseClaim, previewReservationSchema, previewResourceLimits, probePreviewHealth, releaseDockerCreateArguments, releaseDockerNetworkArguments, releaseRetirementActionRequest, releaseRetirementObservation, releaseRetirementRequest, releaseRetirementRevocation, releaseServiceFact, releaseServiceFences, releaseServiceGateBinding, releaseServiceGuardProof, releaseServiceNames, releaseServiceProfile, releaseServiceRequest, releaseWorkspaceFence, renewJob, resourceLimits, runnerCapacity, runnerPreviewLifecycle, serveRunner, startJob, verifyAcceptanceDockerContainer, verifyAcceptanceDockerImage, verifyAcceptanceDockerNetwork, verifyPreviewDockerAbsence, verifyPreviewDockerContainer, verifyPreviewDockerImage, verifyPreviewDockerNetwork, verifyReleaseDockerContainer, verifyReleaseDockerImage, verifyReleaseDockerNetwork, webCrudDatasetProfile, workspaceFenceSchema };

//# sourceMappingURL=index.mjs.map