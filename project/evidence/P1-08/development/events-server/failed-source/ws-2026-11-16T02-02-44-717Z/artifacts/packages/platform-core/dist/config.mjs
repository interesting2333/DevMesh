import { readFileSync } from "node:fs";
import { parseStorageConfig } from "@devmesh/blob-store";
import { loadInternalA2AConfig } from "@devmesh/a2a-adapter/config";
import { parseRuntimeConfig } from "@devmesh/agent-runtime/config";
import { isAbsolute } from "node:path";
//#region src/config.ts
var ConfigError = class extends Error {
	code = "CONFIG_INVALID";
};
function integer(value, field, min, max) {
	const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
	if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new ConfigError(`${field} must be an integer in ${min}..${max}`);
	return parsed;
}
function loadConfig(env = process.env, configPath) {
	const path = configPath ?? env.DEVMESH_CONFIG;
	let file = {};
	if (path !== void 0) {
		let parsed;
		try {
			parsed = JSON.parse(readFileSync(path, "utf8"));
		} catch {
			throw new ConfigError("Cannot read or parse server configuration file");
		}
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new ConfigError("Server configuration must be a JSON object");
		for (const key of Object.keys(parsed)) if (![
			"host",
			"port",
			"shutdownTimeoutMs",
			"storage",
			"a2a",
			"runtime",
			"inputApi",
			"releaseExports"
		].includes(key)) throw new ConfigError(`Unknown server configuration field: ${key}`);
		file = parsed;
	}
	const host = env.DEVMESH_HOST ?? file.host ?? "127.0.0.1";
	if (host !== "127.0.0.1" && host !== "::1") throw new ConfigError("host must be an explicit loopback address (127.0.0.1 or ::1)");
	let storage;
	let storageSources;
	let inputApi;
	let releaseExports;
	if (file.releaseExports !== void 0) {
		const item = file.releaseExports;
		if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some((k) => ![
			"enabled",
			"pollIntervalMs",
			"maxConcurrentJobs",
			"maxJobsPerPass"
		].includes(k))) throw new ConfigError("Invalid releaseExports configuration");
		if (typeof item.enabled !== "boolean") throw new ConfigError("releaseExports.enabled must be explicit");
		const limits = {
			pollIntervalMs: integer(item.pollIntervalMs ?? 1e3, "releaseExports.pollIntervalMs", 100, 6e4),
			maxConcurrentJobs: integer(item.maxConcurrentJobs ?? 2, "releaseExports.maxConcurrentJobs", 1, 2),
			maxJobsPerPass: integer(item.maxJobsPerPass ?? 32, "releaseExports.maxJobsPerPass", 1, 200)
		};
		if (item.enabled) releaseExports = Object.freeze(limits);
	}
	if (file.inputApi !== void 0) {
		const item = file.inputApi;
		if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some((k) => ![
			"enabled",
			"repositoryRoot",
			"commit",
			"templatePath"
		].includes(k))) throw new ConfigError("Invalid inputApi configuration");
		if (typeof item.enabled !== "boolean") throw new ConfigError("inputApi.enabled must be explicit");
		if (item.enabled) {
			if (typeof item.repositoryRoot !== "string" || !isAbsolute(item.repositoryRoot) || typeof item.commit !== "string" || !/^[a-f0-9]{40}$/.test(item.commit)) throw new ConfigError("inputApi requires an absolute trusted repositoryRoot and fixed commit");
			const templatePath = item.templatePath ?? "templates/web-crud-v1";
			if (typeof templatePath !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(templatePath) || templatePath.split("/").includes("..")) throw new ConfigError("Invalid inputApi templatePath");
			inputApi = Object.freeze({
				repositoryRoot: item.repositoryRoot,
				commit: item.commit,
				templatePath
			});
		}
	}
	if (file.storage !== void 0 || env.DEVMESH_DATA_ROOT !== void 0) {
		try {
			storage = parseStorageConfig(file.storage ?? {}, path, env);
		} catch (error) {
			throw new ConfigError(error instanceof Error ? error.message : "Invalid storage configuration");
		}
		const fields = file.storage;
		storageSources = Object.fromEntries([
			["dataRoot", "DEVMESH_DATA_ROOT"],
			["backupRoot", "DEVMESH_BACKUP_ROOT"],
			["runnerDataRoot", "DEVMESH_RUNNER_DATA_ROOT"]
		].map(([field, key]) => [field, env[key] !== void 0 ? "environment" : fields?.[field] !== void 0 ? "file" : field === "runnerDataRoot" ? "unset" : "local-default"]));
	}
	return Object.freeze({
		host,
		port: integer(env.DEVMESH_PORT ?? file.port ?? 3210, "port", 0, 65535),
		shutdownTimeoutMs: integer(env.DEVMESH_SHUTDOWN_TIMEOUT_MS ?? file.shutdownTimeoutMs ?? 5e3, "shutdownTimeoutMs", 100, 3e4),
		...storage ? {
			storage: Object.freeze(storage),
			storageSources: Object.freeze(storageSources)
		} : {},
		...file.a2a !== void 0 ? { a2a: Object.freeze(loadInternalA2AConfig(file.a2a, path)) } : {},
		...file.runtime !== void 0 ? { runtime: Object.freeze(parseRuntimeConfig(file.runtime)) } : {},
		...inputApi ? { inputApi } : {},
		...releaseExports ? { releaseExports } : {}
	});
}
//#endregion
export { ConfigError, loadConfig };

//# sourceMappingURL=config.mjs.map