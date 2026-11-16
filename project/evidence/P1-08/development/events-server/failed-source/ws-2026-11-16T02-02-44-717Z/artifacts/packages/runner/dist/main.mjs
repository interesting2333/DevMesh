import { t as RunnerError } from "./protocol-CrzCRB9P.mjs";
import { i as RunnerMaterials, n as openRunnerStorage, r as RunnerManager, s as RunnerPolicy, t as serveRunner } from "./server-ke1TSt2G.mjs";
import { z } from "zod";
import { opaqueKey } from "@devmesh/contracts";
import { readFileSync } from "node:fs";
//#region src/main.ts
const schema = z.strictObject({
	runnerId: opaqueKey,
	dataRoot: z.string(),
	controlDataRoot: z.string(),
	backupRoot: z.string(),
	host: z.enum(["127.0.0.1", "::1"]).default("127.0.0.1"),
	port: z.number().int().min(0).max(65535).default(3220),
	executionEnabled: z.literal(false).default(false),
	identities: z.array(z.strictObject({
		controllerId: opaqueKey,
		credentialRef: opaqueKey
	})).max(32)
});
let close;
try {
	const args = process.argv.slice(2), initialize = args.includes("--initialize"), path = args[args.indexOf("--config") + 1];
	if (!args.includes("--config") || !path || args.some((v, i) => v !== "--initialize" && v !== "--config" && args[i - 1] !== "--config")) throw new RunnerError("RUNNER_CONFIG_REQUIRED", 422);
	const config = schema.parse(JSON.parse(readFileSync(path, "utf8"))), layout = await openRunnerStorage({
		...config,
		initialize
	});
	close = () => layout.close();
	const unavailable = async () => {
		throw new RunnerError("RUNNER_NOT_CONFIGURED", 503, "not-sent");
	};
	const backend = {
		configured: false,
		probe: unavailable,
		start: unavailable,
		inspect: unavailable,
		stop: unavailable,
		logs: unavailable
	};
	const policy = new RunnerPolicy({
		runnerId: config.runnerId,
		dataRoot: layout.dataRoot,
		imageDigests: [],
		commands: {},
		maximumCpu: 4,
		maximumMemoryMiB: 8192,
		maximumTemporaryMiB: 10240,
		workspaces: {}
	});
	const manager = new RunnerManager(layout.store, policy, backend, { verify: unavailable }, new RunnerMaterials(layout.dataRoot));
	await manager.start();
	const server = await serveRunner(manager, {
		...config,
		credentials: async (ref) => process.env["DEVMESH_CREDENTIAL_" + ref.replaceAll(/[^a-zA-Z0-9]/g, "_").toUpperCase()]
	});
	close = async () => {
		try {
			await server.close();
		} finally {
			await layout.close();
		}
	};
	let stopping = false;
	const stop = async () => {
		if (stopping) return;
		stopping = true;
		try {
			await close?.();
			process.stdout.write(JSON.stringify({ event: "runner.stopped" }) + "\n");
		} catch {
			process.exitCode = 1;
		} finally {
			if (process.connected) process.disconnect();
		}
	};
	process.once("SIGTERM", () => void stop());
	process.once("SIGINT", () => void stop());
	process.on("message", (m) => {
		if (m && typeof m === "object" && "type" in m && m.type === "shutdown") stop();
	});
	process.stdout.write(JSON.stringify({
		event: "runner.ready",
		port: server.address.port,
		executionConfigured: false
	}) + "\n");
} catch (error) {
	await close?.();
	process.stderr.write(JSON.stringify({
		event: "runner.failed",
		code: error instanceof RunnerError ? error.code : "RUNNER_START_FAILED"
	}) + "\n");
	process.exitCode = 1;
}
//#endregion
export {};

//# sourceMappingURL=main.mjs.map