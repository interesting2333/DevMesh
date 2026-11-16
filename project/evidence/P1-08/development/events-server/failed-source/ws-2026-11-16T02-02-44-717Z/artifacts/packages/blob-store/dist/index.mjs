import { closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { link, open, rename, statfs, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { StorageError, acquireWriterLock, canonical, openStorage } from "@devmesh/storage-sqlite";
//#region src/paths.ts
function fail(code, message, status = 409) {
	throw new StorageError(code, status, message);
}
function canonicalRoot(path) {
	if (!isAbsolute(path) || path.startsWith("\\\\") || path.startsWith("//") || path.includes("\0") || process.platform === "win32" && !/^[A-Za-z]:[\\/]/.test(path)) fail("ROOT_PATH_INVALID", "An absolute local root path is required", 422);
	const resolved = resolve(path), root = parse(resolved).root;
	if (resolved === root) fail("ROOT_PATH_INVALID", "A filesystem root cannot be the data directory", 422);
	let current = root;
	for (const part of resolved.slice(root.length).split(sep)) {
		current = join(current, part);
		if (existsSync(current)) {
			const stat = lstatSync(current);
			if (stat.isSymbolicLink() || !stat.isDirectory()) fail("ROOT_LINK_INVALID", "Storage roots cannot traverse links or non-directories");
			current = realpathSync(current);
		} else try {
			if (lstatSync(current).isSymbolicLink()) fail("ROOT_LINK_INVALID", "Dangling links are not storage roots");
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	return current;
}
function isWithin(parent, child) {
	const normalize = (p) => process.platform === "win32" ? p.toLowerCase() : p;
	const rel = relative(normalize(parent), normalize(child));
	return rel === "" || !rel.startsWith(".." + sep) && rel !== ".." && !isAbsolute(rel);
}
function assertSeparate(roots) {
	for (let a = 0; a < roots.length; a++) for (let b = a + 1; b < roots.length; b++) if (isWithin(roots[a], roots[b]) || isWithin(roots[b], roots[a])) fail("STORAGE_ROOTS_OVERLAP", "Control, Runner and backup roots must be separate");
}
function segments(key) {
	const parts = key.split("/");
	if (!parts.length || parts.some((p) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(p) || p.endsWith(".") || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) fail("STORAGE_KEY_INVALID", "Storage keys must be controlled relative names", 422);
	return parts;
}
function safePath(root, key, makeParents = false) {
	const parts = segments(key);
	canonicalRoot(root);
	let current = root;
	for (const [i, part] of parts.entries()) {
		current = join(current, part);
		if (makeParents && i < parts.length - 1 && !existsSync(current)) try {
			mkdirSync(current, { mode: 448 });
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
		}
		try {
			const stat = lstatSync(current);
			if (stat.isSymbolicLink() || i < parts.length - 1 && !stat.isDirectory() || i === parts.length - 1 && !stat.isFile()) fail("STORAGE_LINK_INVALID", "Object path traverses a link or unexpected entry");
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	if (!isWithin(root, current) || dirname(current) === current) fail("STORAGE_KEY_INVALID", "Object escapes its root", 422);
	return current;
}
//#endregion
//#region src/layout.ts
const markerSchema = z.strictObject({
	layoutVersion: z.literal(1),
	storeId: z.uuid(),
	nodeKind: z.literal("control"),
	createdAt: z.iso.datetime()
});
const storageConfigSchema = z.strictObject({
	dataRoot: z.string().min(1).default(".devmesh-data/control"),
	backupRoot: z.string().min(1).default(".devmesh-backups"),
	runnerDataRoot: z.string().min(1).optional(),
	initialize: z.boolean().default(false),
	storeId: z.uuid().optional(),
	recoveryToken: z.uuid().optional(),
	minimumFreeBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(64 * 1024 * 1024),
	mode: z.enum(["local", "shared"]).default("local")
});
function parseStorageConfig(value, configPath, env = process.env) {
	return resolveStorageConfig(storageConfigSchema.parse(value), configPath, env);
}
function resolveStorageConfig(value, configPath, env = process.env) {
	const base = configPath ? dirname(resolve(configPath)) : process.cwd();
	const result = {
		...value,
		dataRoot: env.DEVMESH_DATA_ROOT ?? value.dataRoot,
		backupRoot: env.DEVMESH_BACKUP_ROOT ?? value.backupRoot,
		runnerDataRoot: env.DEVMESH_RUNNER_DATA_ROOT ?? value.runnerDataRoot
	};
	for (const key of [
		"dataRoot",
		"backupRoot",
		"runnerDataRoot"
	]) {
		const path = result[key];
		if (!path) continue;
		if (value.mode === "shared" && !isAbsolute(path)) fail("ROOT_PATH_INVALID", "Shared deployment requires absolute paths", 422);
		result[key] = resolve(base, path);
	}
	return result;
}
function syncDirectory(path) {
	let fd;
	try {
		fd = openSync(path, "r");
		fsyncSync(fd);
		return "supported";
	} catch (error) {
		if (process.platform === "win32" && [
			"EPERM",
			"EISDIR",
			"EINVAL",
			"ENOTSUP",
			"EACCES"
		].includes(error.code ?? "")) return "unsupported";
		throw error;
	} finally {
		if (fd !== void 0) closeSync(fd);
	}
}
async function checkCapacity(root, requestedBytes, reserve) {
	const disk = await statfs(root, { bigint: true });
	const available = disk.bavail * disk.bsize;
	if (!Number.isSafeInteger(requestedBytes) || requestedBytes < 0 || !Number.isSafeInteger(reserve) || reserve < 0) fail("CAPACITY_INVALID", "Byte budgets must be nonnegative safe integers", 422);
	if (available < BigInt(requestedBytes) + BigInt(reserve)) fail("STORAGE_CAPACITY", "Insufficient disk space including the completion reserve", 507);
	return Number(available);
}
async function openLocalStorage(input) {
	const dataRoot = canonicalRoot(input.dataRoot), backupRoot = canonicalRoot(input.backupRoot);
	assertSeparate([
		dataRoot,
		backupRoot,
		...input.runnerDataRoot ? [canonicalRoot(input.runnerDataRoot)] : []
	]);
	if (!existsSync(dataRoot)) {
		if (!input.initialize) fail("STORAGE_NOT_INITIALIZED", "Run storage:init explicitly before starting this data root", 404);
		mkdirSync(dataRoot, {
			recursive: true,
			mode: 448
		});
	}
	const lock = acquireWriterLock(dataRoot + ".node", input.recoveryToken);
	let storage;
	try {
		const markerPath = join(dataRoot, "storage-layout.json"), pendingMarker = join(dataRoot, "storage-layout.initializing.json"), hadMarker = existsSync(markerPath), resuming = !hadMarker && existsSync(pendingMarker);
		if (!hadMarker && (!input.initialize || !resuming && readdirSync(dataRoot).length !== 0)) fail("LAYOUT_UNRECOGNIZED", "Refusing an unknown or nonempty data directory; incomplete initialization requires explicit storage:init");
		if (resuming) {
			safePath(dataRoot, "storage-layout.initializing.json");
			const allowed = /* @__PURE__ */ new Set([
				"storage-layout.initializing.json",
				"db",
				"artifacts",
				"repositories",
				"views",
				"staging",
				"logs",
				"cache",
				"manifests",
				"locks",
				"trash"
			]);
			if (readdirSync(dataRoot).some((name) => !allowed.has(name))) fail("LAYOUT_UNRECOGNIZED", "Incomplete layout contains unrecognized entries");
		}
		let marker;
		if (hadMarker) {
			if (statSync(markerPath).nlink !== 1) fail("LAYOUT_UNRECOGNIZED", "Layout marker must be a regular independent file");
			safePath(dataRoot, "storage-layout.json");
			marker = markerSchema.parse(JSON.parse(readFileSync(markerPath, "utf8")));
			if (input.storeId && marker.storeId !== input.storeId) fail("STORE_IDENTITY_MISMATCH", "Configured storeId differs from layout marker");
		} else {
			marker = markerSchema.parse(resuming ? JSON.parse(readFileSync(pendingMarker, "utf8")) : {
				layoutVersion: 1,
				storeId: input.storeId ?? randomUUID(),
				nodeKind: "control",
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			if (input.storeId && marker.storeId !== input.storeId) fail("STORE_IDENTITY_MISMATCH", "Initialization identity differs from requested store");
			if (!resuming) {
				const fd = openSync(pendingMarker, "wx", 384);
				try {
					writeFileSync(fd, JSON.stringify(marker, null, 2) + "\n");
					fsyncSync(fd);
				} finally {
					closeSync(fd);
				}
			}
			syncDirectory(dataRoot);
		}
		for (const dir of [
			"db",
			"artifacts",
			"artifacts/sha256",
			"repositories",
			"views",
			"views/projects",
			"views/sessions",
			"views/invocations",
			"views/exports",
			"staging",
			"staging/uploads",
			"staging/objects",
			"staging/imports",
			"staging/exports",
			"logs",
			"logs/control",
			"cache",
			"manifests",
			"manifests/backups",
			"locks",
			"trash"
		]) {
			const path = join(dataRoot, dir);
			canonicalRoot(path);
			if (!existsSync(path)) mkdirSync(path, { mode: 448 });
		}
		if (!existsSync(backupRoot)) mkdirSync(backupRoot, {
			recursive: true,
			mode: 448
		});
		const reserve = input.minimumFreeBytes ?? 64 * 1024 * 1024;
		await checkCapacity(dataRoot, 0, reserve);
		if (statSync(join(dataRoot, "staging/objects")).dev !== statSync(join(dataRoot, "artifacts")).dev) fail("STORAGE_CROSS_VOLUME", "Staging and content must share a filesystem");
		const probe = "probe_" + randomUUID().replaceAll("-", ""), source = join(dataRoot, "staging/objects", probe), target = join(dataRoot, "artifacts", probe);
		try {
			const fd = openSync(source, "wx", 384);
			try {
				writeFileSync(fd, "probe");
				fsyncSync(fd);
			} finally {
				closeSync(fd);
			}
			linkSync(source, target);
		} finally {
			if (existsSync(source)) unlinkSync(source);
			if (existsSync(target)) unlinkSync(target);
		}
		const directorySync = syncDirectory(join(dataRoot, "artifacts"));
		const databasePath = join(dataRoot, "db/devmesh.sqlite");
		if (hadMarker && !existsSync(databasePath)) fail("DATABASE_NOT_FOUND", "Existing layout has no database; refusing implicit recreation", 404);
		let databaseRecovery;
		if (input.recoveryToken && existsSync(databasePath + ".writer.lock")) databaseRecovery = JSON.parse(readFileSync(databasePath + ".writer.lock", "utf8")).token;
		storage = await openStorage({
			databasePath,
			storeId: marker.storeId,
			layoutVersion: 1,
			create: !existsSync(databasePath),
			backupDirectory: backupRoot,
			...databaseRecovery ? { recoveryToken: databaseRecovery } : {}
		});
		await storage.request("recoverContentReads", {});
		if (!hadMarker) {
			renameSync(pendingMarker, markerPath);
			syncDirectory(dataRoot);
		}
		let closing;
		const client = storage;
		return {
			storage: client,
			dataRoot,
			backupRoot,
			marker,
			directorySync,
			minimumFreeBytes: reserve,
			close() {
				return closing ??= (async () => {
					try {
						await client.close();
					} finally {
						lock.release();
					}
				})();
			}
		};
	} catch (error) {
		try {
			await storage?.close();
		} finally {
			lock.release();
		}
		throw error;
	}
}
//#endregion
//#region src/provider.ts
var LocalBlobProvider = class {
	dataRoot;
	minimumFreeBytes;
	constructor(dataRoot, minimumFreeBytes = 64 * 1024 * 1024) {
		this.dataRoot = dataRoot;
		this.minimumFreeBytes = minimumFreeBytes;
	}
	#object(hash, create = false) {
		if (!/^[a-f0-9]{64}$/.test(hash)) fail("CONTENT_HASH_INVALID", "Expected a SHA-256 content hash", 422);
		return safePath(join(this.dataRoot, "artifacts"), `sha256/${hash.slice(0, 2)}/${hash}`, create);
	}
	#stage(write) {
		if (!/^objects\/write_[a-f0-9]{32}\.part$/.test(write.stagingKey)) fail("STAGING_KEY_INVALID", "Unexpected staging key", 422);
		return safePath(join(this.dataRoot, "staging"), write.stagingKey);
	}
	async #verifyHandle(file, expectedHash, expectedSize) {
		const stat = await file.stat();
		if (!stat.isFile() || expectedSize !== void 0 && stat.size !== expectedSize) fail("CONTENT_CORRUPT", "Content size differs from its immutable reference", 503);
		const hash = createHash("sha256");
		let size = 0;
		for await (const chunk of file.createReadStream({
			start: 0,
			autoClose: false
		})) {
			hash.update(chunk);
			size += chunk.length;
		}
		if (hash.digest("hex") !== expectedHash) fail("CONTENT_CORRUPT", "Content hash differs from its immutable reference", 503);
		return {
			contentHash: expectedHash,
			byteSize: size
		};
	}
	async verify(contentHash, expectedSize) {
		let file;
		try {
			file = await open(this.#object(contentHash), "r");
		} catch (error) {
			if (error.code === "ENOENT") throw new StorageError("CONTENT_MISSING", 503, "Referenced bytes are missing");
			throw error;
		}
		try {
			return await this.#verifyHandle(file, contentHash, expectedSize);
		} finally {
			await file.close();
		}
	}
	async stage(write, source) {
		await checkCapacity(this.dataRoot, write.expectedSize, this.minimumFreeBytes);
		const path = this.#stage(write);
		try {
			const old = await open(path, "r");
			try {
				await this.#verifyHandle(old, write.expectedHash, write.expectedSize);
				return;
			} catch (error) {
				if (!(error instanceof StorageError) || error.code !== "CONTENT_CORRUPT") throw error;
			} finally {
				await old.close();
			}
			await unlink(path);
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		const file = await open(path, "wx", 384), hash = createHash("sha256");
		let size = 0;
		try {
			const chunks = source instanceof Uint8Array ? (async function* () {
				yield source;
			})() : source;
			for await (const chunk of chunks) {
				if (!(chunk instanceof Uint8Array)) fail("BYTE_SOURCE_INVALID", "Content streams must contain bytes", 422);
				size += chunk.byteLength;
				if (size > write.expectedSize) fail("CONTENT_SIZE_MISMATCH", "Received more bytes than declared", 422);
				hash.update(chunk);
				let offset = 0;
				while (offset < chunk.byteLength) {
					const result = await file.write(chunk, offset, chunk.byteLength - offset);
					if (!result.bytesWritten) fail("CONTENT_WRITE_FAILED", "No progress writing staged bytes", 507);
					offset += result.bytesWritten;
				}
			}
			if (size !== write.expectedSize || hash.digest("hex") !== write.expectedHash) fail("CONTENT_SIZE_MISMATCH", "Actual content size/hash differs from the declaration", 422);
			await file.sync();
		} finally {
			await file.close();
		}
		syncDirectory(dirname(path));
	}
	async publish(write) {
		const source = this.#stage(write), target = this.#object(write.expectedHash, true);
		const file = await open(source, "r");
		try {
			await this.#verifyHandle(file, write.expectedHash, write.expectedSize);
		} finally {
			await file.close();
		}
		try {
			await link(source, target);
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
			await this.verify(write.expectedHash, write.expectedSize);
		}
		syncDirectory(dirname(target));
		await unlink(source);
		syncDirectory(dirname(source));
		return this.verify(write.expectedHash, write.expectedSize);
	}
	async openRead(contentHash, expectedSize) {
		let file;
		try {
			file = await open(this.#object(contentHash), "r");
		} catch (error) {
			if (error.code === "ENOENT") throw new StorageError("CONTENT_MISSING", 503, "Referenced bytes are missing");
			throw error;
		}
		try {
			await this.#verifyHandle(file, contentHash, expectedSize);
			return file.createReadStream({
				start: 0,
				autoClose: true
			});
		} catch (error) {
			await file.close();
			throw error;
		}
	}
	/** Only call after the storage transaction reserved DELETING and checked references/pins. */
	async delete(contentHash) {
		const path = this.#object(contentHash);
		try {
			await unlink(path);
			syncDirectory(dirname(path));
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
};
//#endregion
//#region src/store.ts
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const textDecoder = new TextDecoder("utf-8", { fatal: true });
var LocalContentStore = class {
	storage;
	dataRoot;
	#inflight = /* @__PURE__ */ new Map();
	provider;
	constructor(storage, dataRoot, minimumFreeBytes = 64 * 1024 * 1024, provider) {
		this.storage = storage;
		this.dataRoot = dataRoot;
		this.provider = provider ?? new LocalBlobProvider(dataRoot, minimumFreeBytes);
	}
	async put(input, source) {
		const write = await this.storage.request("beginObjectWrite", input);
		const existing = this.#inflight.get(write.writeId);
		if (existing) return existing;
		const promise = this.#complete(write, source);
		this.#inflight.set(write.writeId, promise);
		try {
			return await promise;
		} finally {
			this.#inflight.delete(write.writeId);
		}
	}
	async #complete(write, source) {
		if (write.state === "REGISTERED") return write;
		let published = false;
		try {
			try {
				if ((await this.provider.verify(write.expectedHash)).byteSize !== write.expectedSize) fail("CONTENT_SIZE_MISMATCH", "Declared size differs from the verified bytes", 422);
				published = true;
			} catch (error) {
				if (!(error instanceof StorageError) || error.code !== "CONTENT_MISSING") throw error;
				if (source === void 0) throw error;
				await this.provider.stage(write, source);
				await this.provider.publish(write);
				published = true;
			}
			await this.storage.request("sealObjectWrite", {
				principalId: write.ownerId,
				writeId: write.writeId
			});
			return await this.storage.request("commitObjectWrite", {
				principalId: write.ownerId,
				writeId: write.writeId
			});
		} catch (error) {
			if (!published) await this.storage.request("failObjectWrite", {
				principalId: write.ownerId,
				writeId: write.writeId,
				error: error instanceof Error ? error.message.slice(0, 2e3) : "Content write failed"
			}).catch(() => {});
			throw error;
		}
	}
	putBytes(meta, target, bytes, mimeType = "application/octet-stream") {
		return this.put({
			meta,
			target,
			expectedHash: digest(bytes),
			expectedSize: bytes.byteLength,
			mimeType
		}, bytes);
	}
	putText(meta, target, text, mimeType = "text/plain; charset=utf-8") {
		return this.putBytes(meta, target, Buffer.from(text, "utf8"), mimeType);
	}
	putJson(meta, target, value) {
		return this.putText(meta, target, canonical(value), "application/json");
	}
	async recoverPublished() {
		const recovered = [], pending = [];
		let cursor = "";
		while (true) {
			const page = await this.storage.request("scanObjectWrites", {
				afterWriteId: cursor,
				limit: 200
			});
			if (!page.length) break;
			for (const write of page) try {
				await this.#complete(write);
				recovered.push(write.writeId);
			} catch (error) {
				pending.push({
					writeId: write.writeId,
					code: error instanceof StorageError ? error.code : "CONTENT_FAILURE"
				});
			}
			cursor = page.at(-1).writeId;
		}
		return {
			recovered,
			pending
		};
	}
	async verifyAll() {
		let cursor = "", checked = 0;
		const failures = [];
		while (true) {
			const rows = await this.storage.request("listContentObjects", {
				afterHash: cursor,
				limit: 200
			});
			if (!rows.length) break;
			for (const row of rows) {
				if (row.state === "DELETING") continue;
				checked++;
				try {
					await this.provider.verify(row.contentHash, row.byteSize);
					if (row.state !== "READY") fail("CONTENT_UNAVAILABLE", "Content requires explicit restoration", 503);
				} catch (error) {
					const code = error instanceof StorageError ? error.code : "CONTENT_FAILURE";
					if (code === "CONTENT_MISSING" || code === "CONTENT_CORRUPT") await this.storage.request("markContentMissing", {
						contentHash: row.contentHash,
						error: code
					});
					failures.push({
						contentHash: row.contentHash,
						code
					});
				}
			}
			cursor = rows.at(-1).contentHash;
		}
		return {
			checked,
			failures
		};
	}
	async openRead(principalId, reference) {
		const content = await this.storage.request("resolveContentRead", {
			principalId,
			reference
		});
		let released;
		const release = () => released ??= (async () => {
			await this.storage.request("releaseContentRead", {
				principalId,
				pinId: content.pinId
			});
		})();
		try {
			const stream = await this.provider.openRead(content.contentHash, content.byteSize);
			stream.once("close", () => {
				release().catch(() => {});
			});
			return {
				stream,
				content,
				release
			};
		} catch (error) {
			if (error instanceof StorageError && ["CONTENT_MISSING", "CONTENT_CORRUPT"].includes(error.code)) await this.storage.request("markContentMissing", {
				contentHash: content.contentHash,
				error: error.code
			});
			await release();
			throw error;
		}
	}
	async readBytes(principalId, reference, maxBytes = 32 * 1024 * 1024) {
		const opened = await this.openRead(principalId, reference);
		try {
			if (opened.content.byteSize > maxBytes) fail("CONTENT_TOO_LARGE", "Use streaming reads for this object", 413);
			const chunks = [];
			let size = 0;
			for await (const chunk of opened.stream) {
				const bytes = Buffer.from(chunk);
				size += bytes.length;
				if (size > maxBytes) fail("CONTENT_TOO_LARGE", "Read exceeds its byte budget", 413);
				chunks.push(bytes);
			}
			return Buffer.concat(chunks);
		} finally {
			opened.stream.destroy();
			await opened.release();
		}
	}
	async readText(principalId, reference, maxBytes = 32 * 1024 * 1024) {
		return textDecoder.decode(await this.readBytes(principalId, reference, maxBytes));
	}
	/** Maintenance primitive only. The caller supplies the retention decision; no automatic GC. */
	async deleteUnreferenced(contentHash) {
		await this.storage.request("beginContentDeletion", { contentHash });
		await this.provider.delete(contentHash);
		await this.storage.request("finishContentDeletion", { contentHash });
	}
};
function modelPayload(value, depth = 0) {
	if (depth > 64) fail("MODEL_PAYLOAD_INVALID", "Model payload nesting is too deep", 422);
	if (Array.isArray(value)) {
		for (const item of value) modelPayload(item, depth + 1);
		return;
	}
	if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
		if (/^(authorization|cookie|set-cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|reasoning_content|thinking|chain_of_thought)$/i.test(key)) fail("PRIVATE_MODEL_FIELD", "Transport credentials and internal reasoning cannot be persisted in model payloads", 422);
		modelPayload(item, depth + 1);
	}
}
var SessionStore = class {
	content;
	constructor(content) {
		this.content = content;
	}
	get storage() {
		return this.content.storage;
	}
	ensure(principalId, runId, attemptId) {
		return this.storage.request("ensureSession", {
			principalId,
			runId,
			attemptId
		});
	}
	append(meta, target, text) {
		return this.content.putText(meta, target, text);
	}
	async snapshot(meta, sessionId, configHash) {
		const s = await this.storage.request("getSession", {
			principalId: meta.principalId,
			sessionId
		});
		if (s.lastMessageSeq > 200) fail("CONTEXT_COMPRESSION_REQUIRED", "Prepare an explicit summary before creating a larger context", 409);
		const page = await this.storage.request("listSessionMessages", {
			principalId: meta.principalId,
			sessionId,
			limit: 200
		});
		const manifest = {
			schemaVersion: "devmesh.context.v1",
			sessionId,
			roleSnapshotId: s.roleSnapshotId,
			throughMessageSeq: s.lastMessageSeq,
			configHash,
			messages: page.messages.filter((m) => m.seq <= s.lastMessageSeq).map((m) => ({
				messageId: m.messageId,
				seq: m.seq,
				sha256: m.contentHash
			}))
		};
		return this.content.putJson(meta, {
			kind: "context",
			manifest
		}, manifest);
	}
	async saveRequest(meta, target, request) {
		modelPayload(request);
		return this.content.putJson(meta, target, request);
	}
	async saveResponse(meta, target, response) {
		modelPayload(response);
		return this.content.putJson(meta, target, response);
	}
	async exportJsonl(principalId, sessionId) {
		const s = await this.storage.request("getSession", {
			principalId,
			sessionId
		});
		const key = `sessions/${sessionId}/transcript.jsonl`, root = join(this.content.dataRoot, "views");
		const transcriptPath = safePath(root, key, true), manifestPath = safePath(root, `sessions/${sessionId}/manifest.json`);
		const temporary = transcriptPath + "." + randomUUID().replaceAll("-", "") + ".part";
		const file = await open(temporary, "wx", 384), hash = createHash("sha256");
		let cursor = 0;
		try {
			while (cursor < s.lastMessageSeq) {
				const page = await this.storage.request("listSessionMessages", {
					principalId,
					sessionId,
					afterSeq: cursor,
					limit: 200
				});
				if (!page.messages.length) fail("SESSION_HISTORY_GAP", "Cannot project a missing message sequence", 503);
				for (const m of page.messages) {
					if (m.seq > s.lastMessageSeq) break;
					if (m.seq !== cursor + 1) fail("SESSION_HISTORY_GAP", "Cannot project a missing message sequence", 503);
					const body = await this.content.readText(principalId, {
						kind: "message",
						messageId: m.messageId
					});
					const line = canonical({
						...m,
						body
					}) + "\n";
					await file.writeFile(line, "utf8");
					hash.update(line);
					cursor = m.seq;
				}
			}
			await file.sync();
		} finally {
			await file.close();
		}
		const checksum = hash.digest("hex");
		await rename(temporary, transcriptPath);
		syncDirectory(dirname(transcriptPath));
		const manifest = {
			schemaVersion: "devmesh.session-view.v1",
			sessionId,
			runId: s.runId,
			attemptId: s.attemptId,
			throughMessageSeq: cursor,
			sourceRevision: {
				lastStepNo: s.lastStepNo,
				lastMessageSeq: s.lastMessageSeq
			},
			generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			sha256: checksum
		};
		const stagedManifest = manifestPath + "." + randomUUID().replaceAll("-", "") + ".part", output = await open(stagedManifest, "wx", 384);
		try {
			await output.writeFile(canonical(manifest) + "\n", "utf8");
			await output.sync();
		} finally {
			await output.close();
		}
		await rename(stagedManifest, manifestPath);
		syncDirectory(dirname(manifestPath));
		return {
			throughMessageSeq: cursor,
			sha256: checksum,
			manifestPath,
			transcriptPath
		};
	}
};
//#endregion
export { LocalBlobProvider, LocalContentStore, SessionStore, assertSeparate, canonicalRoot, checkCapacity, openLocalStorage, parseStorageConfig, resolveStorageConfig, safePath };

//# sourceMappingURL=index.mjs.map