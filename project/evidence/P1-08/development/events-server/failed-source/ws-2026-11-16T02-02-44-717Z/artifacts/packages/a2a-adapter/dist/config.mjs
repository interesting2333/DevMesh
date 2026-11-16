import { agentManifest } from "@devmesh/storage-sqlite";
import { opaqueKey, parseContract } from "@devmesh/contracts";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
//#region src/config.ts
function loadInternalA2AConfig(value, configPath) {
	const config = parseContract(z.strictObject({
		manifestPath: z.string().min(1),
		identities: z.array(z.strictObject({
			principalId: opaqueKey,
			credentialRef: opaqueKey
		})).max(32)
	}), value);
	if (new Set(config.identities.map((identity) => identity.principalId)).size !== config.identities.length || new Set(config.identities.map((identity) => identity.credentialRef)).size !== config.identities.length) throw new Error("Service identities and credential references must be unique");
	const path = resolve(configPath ? dirname(resolve(configPath)) : process.cwd(), config.manifestPath);
	return {
		manifest: parseContract(agentManifest, JSON.parse(readFileSync(path, "utf8"))),
		identities: config.identities
	};
}
//#endregion
export { loadInternalA2AConfig };

//# sourceMappingURL=config.mjs.map