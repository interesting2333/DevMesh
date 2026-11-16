import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { devNull } from "node:os";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { assertSeparate, canonicalRoot } from "@devmesh/blob-store";
import { acquireWriterLock, candidateMaterialKey, candidateReportEnvelope, canonical, managedSourcePath, sourceManifest, workspacePreservationMaterialKey } from "@devmesh/storage-sqlite";
import { executionPermit, gitCommit, opaqueKey, parseContract } from "@devmesh/contracts";
import { acquireWorkspaceFence } from "@devmesh/runner";
import { constants } from "node:fs";
//#region src/git.ts
var WorkspaceError = class extends Error {
	code;
	outcome;
	constructor(code, outcome = "not-sent") {
		super(code);
		this.code = code;
		this.outcome = outcome;
		this.name = "WorkspaceError";
	}
};
function deny$2(code) {
	throw new WorkspaceError(code);
}
const sha = (v) => /^[a-f0-9]{40}$/.test(v) ? v : deny$2("GIT_OBJECT_INVALID");
const decode = (v) => new TextDecoder("utf-8", { fatal: true }).decode(v);
const nullFile = process.platform === "win32" ? "NUL" : devNull;
const hash$6 = (v) => createHash("sha256").update(v).digest("hex");
const safePath = (v) => managedSourcePath.safeParse(v).success;
const ref = (v) => /^refs\/devmesh\/[a-z0-9][a-z0-9/_.-]{0,220}$/.test(v) && !v.includes("..") && !v.includes("//") && !v.endsWith("/") && !v.endsWith(".lock") ? v : deny$2("GIT_REF_DENIED");
const attemptRef = (attemptId) => /^attempt_[A-Za-z0-9_-]{1,110}$/.test(attemptId) ? "refs/heads/devmesh/" + attemptId : deny$2("GIT_REF_DENIED");
/** Only fixed operations are public. There is no caller-provided argv or URL. */
var ControlledGit = class ControlledGit {
	identity;
	binary;
	directories;
	constructor(identity, binary, directories) {
		this.identity = identity;
		this.binary = binary;
		this.directories = directories;
	}
	static async initialize(root, kind, binary = "git") {
		canonicalRoot(root);
		await mkdir(root, { recursive: false });
		if ((await readdir(root)).length) deny$2("GIT_DIRECTORY_NOT_EMPTY");
		await ControlledGit.run(binary, root, [
			"init",
			"--quiet",
			"--object-format=sha1",
			...kind === "bare" ? ["--bare"] : []
		], void 0);
		return ControlledGit.open(root, kind, binary);
	}
	static async open(root, kind, binary = "git") {
		canonicalRoot(root);
		if (!binary || binary.includes("\0")) deny$2("GIT_CONFIGURATION_INVALID");
		const physical = await realpath(root);
		const [format, gitDirectory, commonDirectory, bare] = decode((await ControlledGit.run(binary, physical, [
			"rev-parse",
			"--show-object-format",
			"--absolute-git-dir",
			"--git-common-dir",
			"--is-bare-repository"
		], void 0)).out).trim().split("\n");
		if (format !== "sha1" || !gitDirectory || !commonDirectory || bare !== (kind === "bare" ? "true" : "false")) deny$2("GIT_CONFIGURATION_INVALID");
		const git = await realpath(gitDirectory), common = await realpath(resolve(physical, commonDirectory));
		if (git !== common || git !== (kind === "bare" ? physical : await realpath(join(physical, ".git")))) deny$2("GIT_SHARED_DIRECTORY_DENIED");
		const directories = await Promise.all([.../* @__PURE__ */ new Set([
			physical,
			git,
			common
		])].map(async (path) => {
			const stat = await lstat(path, { bigint: true });
			if (!stat.isDirectory() || stat.isSymbolicLink()) deny$2("GIT_DIRECTORY_CHANGED");
			return Object.freeze({
				path,
				dev: stat.dev,
				ino: stat.ino
			});
		}));
		const provider = new ControlledGit(Object.freeze({
			root: physical,
			gitDirectory: git,
			commonDirectory: common,
			kind
		}), binary, Object.freeze(directories));
		await provider.validate();
		return provider;
	}
	static run(binary, root, args, signal, input, maxBytes = 16 * 1024 * 1024, allowFailure = false) {
		if (signal?.aborted) throw new WorkspaceError("GIT_ABORTED");
		const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith("GIT_")));
		Object.assign(env, {
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_CONFIG_GLOBAL: nullFile,
			GIT_ATTR_NOSYSTEM: "1",
			GIT_TERMINAL_PROMPT: "0",
			GIT_OPTIONAL_LOCKS: "0",
			GIT_LITERAL_PATHSPECS: "1",
			LC_ALL: "C"
		});
		return new Promise((resolve, reject) => {
			const child = spawn(binary, [
				"--no-replace-objects",
				"--literal-pathspecs",
				"-c",
				"core.hooksPath=" + nullFile,
				"-c",
				"core.fsmonitor=false",
				"-c",
				"core.attributesFile=" + nullFile,
				"-c",
				"core.autocrlf=false",
				"-c",
				"core.fsync=all",
				"-c",
				"core.fsyncMethod=fsync",
				"-c",
				"commit.gpgSign=false",
				"-c",
				"protocol.allow=never",
				...args
			], {
				cwd: root,
				env,
				windowsHide: true,
				stdio: [
					"pipe",
					"pipe",
					"pipe"
				],
				...signal ? { signal } : {}
			});
			const chunks = [];
			let bytes = 0, overflow = false, ioFailure = false;
			const timer = setTimeout(() => {
				overflow = true;
				child.kill();
			}, 3e4);
			timer.unref();
			child.stdout.on("data", (part) => {
				bytes += part.length;
				if (bytes > maxBytes) {
					overflow = true;
					child.kill();
				} else chunks.push(part);
			});
			child.stderr.resume();
			child.stdin.on("error", () => {});
			child.stdin.end(input);
			child.once("error", () => {
				ioFailure = true;
			});
			child.once("close", (code) => {
				clearTimeout(timer);
				if (ioFailure) reject(new WorkspaceError("GIT_IO_UNKNOWN", "unknown"));
				else if (overflow || code === null || code !== 0 && !allowFailure) reject(new WorkspaceError("GIT_ACTION_UNKNOWN", "unknown"));
				else resolve({
					code,
					out: Buffer.concat(chunks)
				});
			});
		});
	}
	call(args, signal, input, maxBytes, allowFailure = false) {
		return ControlledGit.run(this.binary, this.identity.root, args, signal, input, maxBytes, allowFailure);
	}
	async validate(signal) {
		const b = this.identity;
		canonicalRoot(b.root);
		if (await realpath(b.root) !== b.root) deny$2("GIT_DIRECTORY_CHANGED");
		for (const entry of this.directories) {
			const stat = await lstat(entry.path, { bigint: true });
			if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== entry.dev || stat.ino !== entry.ino) deny$2("GIT_DIRECTORY_CHANGED");
		}
		const [format, git, common, bare] = decode((await this.call([
			"rev-parse",
			"--show-object-format",
			"--absolute-git-dir",
			"--git-common-dir",
			"--is-bare-repository"
		], signal)).out).trim().split("\n");
		if (format !== "sha1" || !git || !common || await realpath(git) !== b.gitDirectory || await realpath(resolve(b.root, common)) !== b.commonDirectory || bare !== (b.kind === "bare" ? "true" : "false")) deny$2("GIT_DIRECTORY_CHANGED");
		if (b.kind === "checkout" && await realpath(decode((await this.call(["rev-parse", "--show-toplevel"], signal)).out).trim()) !== b.root) deny$2("GIT_DIRECTORY_CHANGED");
		if ((await this.call([
			"config",
			"--get-regexp",
			"^(filter|merge)\\."
		], signal, void 0, void 0, true)).code !== 1) deny$2("GIT_HELPER_DENIED");
		for (const name of ["alternates", "http-alternates"]) try {
			await lstat(join(b.gitDirectory, "objects/info", name));
			deny$2("GIT_ALTERNATES_DENIED");
		} catch (e) {
			if (e.code !== "ENOENT") throw e;
		}
	}
	async commit(commit, signal) {
		sha(commit);
		await this.validate(signal);
		const bytes = (await this.call([
			"cat-file",
			"commit",
			commit
		], signal, void 0, 1024 * 1024)).out;
		if (createHash("sha1").update(Buffer.from("commit " + bytes.length + "\0")).update(bytes).digest("hex") !== commit) deny$2("GIT_COMMIT_INVALID");
		const body = decode(bytes), headers = body.split("\n\n", 1)[0].split("\n"), tree = headers[0]?.slice(5);
		if (!body.startsWith("tree ") || !tree) deny$2("GIT_COMMIT_INVALID");
		return {
			commit,
			tree: sha(tree),
			parents: headers.filter((v) => v.startsWith("parent ")).map((v) => sha(v.slice(7))),
			body
		};
	}
	async readBlob(objectId, signal) {
		sha(objectId);
		await this.validate(signal);
		return (await this.call([
			"cat-file",
			"blob",
			objectId
		], signal, void 0, 2 * 1024 * 1024)).out;
	}
	async treeEntries(commit, signal) {
		const info = await this.commit(commit, signal), rows = decode((await this.call([
			"ls-tree",
			"-r",
			"-t",
			"-z",
			info.tree
		], signal)).out).split("\0").filter(Boolean);
		if (rows.length > 8e3) deny$2("GIT_SOURCE_TOO_LARGE");
		const entries = rows.map((row) => {
			const m = /^(100644|100755|040000) (blob|tree) ([a-f0-9]{40})\t(.+)$/.exec(row);
			if (!m || !safePath(m[4]) || m[1] === "040000" !== (m[2] === "tree")) deny$2("GIT_SOURCE_PATH_DENIED");
			return m[1] === "040000" ? {
				path: m[4],
				kind: "DIRECTORY",
				mode: "040000",
				objectId: m[3]
			} : {
				path: m[4],
				kind: "FILE",
				mode: m[1],
				objectId: m[3]
			};
		});
		if (new Set(entries.map((entry) => entry.path.toLowerCase())).size !== entries.length) deny$2("GIT_SOURCE_PATH_COLLISION");
		return entries;
	}
	async manifest(commit, signal) {
		const info = await this.commit(commit, signal), tree = await this.treeManifest(info.tree, signal), basis = {
			commit,
			tree: info.tree,
			files: tree.files,
			byteSize: tree.byteSize
		};
		if (Buffer.byteLength(canonical(basis)) > 192 * 1024) deny$2("GIT_SOURCE_MANIFEST_TOO_LARGE");
		return {
			...basis,
			sha256: hash$6(canonical(basis))
		};
	}
	async treeManifest(tree, signal) {
		const rows = decode((await this.call([
			"ls-tree",
			"-r",
			"-z",
			sha(tree)
		], signal)).out).split("\0").filter(Boolean);
		if (rows.length > 2e3) deny$2("GIT_SOURCE_TOO_LARGE");
		const items = rows.map((row) => {
			const m = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(row);
			if (!m || !safePath(m[3])) deny$2("GIT_SOURCE_PATH_DENIED");
			return {
				path: m[3],
				mode: m[1],
				objectId: m[2]
			};
		});
		if (new Set(items.map((v) => v.path.toLowerCase())).size !== items.length) deny$2("GIT_SOURCE_PATH_COLLISION");
		const data = (await this.call(["cat-file", "--batch"], signal, Buffer.from(items.map((v) => v.objectId + "\n").join("")), 12 * 1024 * 1024)).out;
		let cursor = 0, total = 0;
		const files = [];
		for (const item of items) {
			const end = data.indexOf(10, cursor);
			if (end < cursor) deny$2("GIT_SOURCE_INVALID");
			const header = decode(data.subarray(cursor, end)), m = /^([a-f0-9]{40}) blob (\d+)$/.exec(header);
			if (!m || m[1] !== item.objectId) deny$2("GIT_SOURCE_INVALID");
			const size = Number(m[2]);
			if (!Number.isSafeInteger(size) || size > 2 * 1024 * 1024) deny$2("GIT_SOURCE_TOO_LARGE");
			total += size;
			if (total > 8 * 1024 * 1024) deny$2("GIT_SOURCE_TOO_LARGE");
			const start = end + 1, content = data.subarray(start, start + size);
			if (content.length !== size || data[start + size] !== 10) deny$2("GIT_SOURCE_INVALID");
			files.push({
				...item,
				byteSize: size,
				sha256: hash$6(content)
			});
			cursor = start + size + 1;
		}
		if (cursor !== data.length) deny$2("GIT_SOURCE_INVALID");
		const basis = {
			tree,
			files,
			byteSize: total
		};
		return {
			...basis,
			sha256: hash$6(canonical(basis))
		};
	}
	async createTemplateBaseline(source, sourceCommit, sourcePath, version, signal) {
		if (this.identity.kind !== "bare" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version) || !sourcePath.split("/").every((p) => /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(p))) deny$2("GIT_TEMPLATE_CONFIGURATION_INVALID");
		await source.commit(sourceCommit, signal);
		await this.validate(signal);
		const tree = sha(decode((await source.call([
			"rev-parse",
			"--verify",
			sourceCommit + ":" + sourcePath
		], signal)).out).trim()), expected = await source.treeManifest(tree, signal);
		const pack = (await source.call([
			"pack-objects",
			"--stdout",
			"--revs",
			"--no-reuse-delta",
			"--no-reuse-object"
		], signal, Buffer.from(tree + "\n"), 64 * 1024 * 1024)).out;
		await this.call([
			"index-pack",
			"--stdin",
			"--strict"
		], signal, pack);
		if ((await this.treeManifest(tree, signal)).sha256 !== expected.sha256) deny$2("GIT_TEMPLATE_SOURCE_CHANGED");
		const identity = "DevMesh <devmesh@localhost> 946684800 +0000", body = `tree ${tree}\nauthor ${identity}\ncommitter ${identity}\n\nDevMesh template ${version}\nSource: ${sourceCommit}:${sourcePath}\n`, commit = createHash("sha1").update(Buffer.from("commit " + Buffer.byteLength(body) + "\0")).update(body).digest("hex");
		if (sha(decode((await this.call([
			"hash-object",
			"-t",
			"commit",
			"-w",
			"--stdin"
		], signal, Buffer.from(body))).out).trim()) !== commit) deny$2("GIT_TEMPLATE_SOURCE_CHANGED");
		const name = "refs/devmesh/templates/" + version, existing = await this.readRef(name, signal);
		if (existing !== commit && (existing !== null || !await this.updateRefs([{
			ref: name,
			commit,
			expected: null
		}], signal))) deny$2("GIT_TEMPLATE_VERSION_CHANGED");
		return {
			version,
			baseCommit: commit,
			sourceCommit,
			sourcePath,
			manifest: await this.manifest(commit, signal)
		};
	}
	async changedPaths(base, commit, signal) {
		sha(base);
		sha(commit);
		await this.validate(signal);
		const result = decode((await this.call([
			"diff-tree",
			"--no-commit-id",
			"--name-only",
			"-r",
			"-z",
			"--no-renames",
			base,
			commit,
			"--"
		], signal)).out).split("\0").filter(Boolean);
		if (result.length > 2e3 || result.some((p) => !safePath(p))) deny$2("GIT_SOURCE_PATH_DENIED");
		return result;
	}
	async exportCommit(commit, signal) {
		await this.manifest(commit, signal);
		return (await this.call([
			"pack-objects",
			"--stdout",
			"--revs",
			"--no-reuse-delta",
			"--no-reuse-object"
		], signal, Buffer.from(sha(commit) + "\n"), 64 * 1024 * 1024)).out;
	}
	async importCommit(pack, commit, signal) {
		sha(commit);
		await this.validate(signal);
		if (pack.length > 64 * 1024 * 1024 || decode(pack.subarray(0, 4)) !== "PACK") deny$2("GIT_PACK_DENIED");
		await this.call([
			"index-pack",
			"--stdin",
			"--strict"
		], signal, pack);
		return this.manifest(commit, signal);
	}
	async checkout(commit, signal) {
		if (this.identity.kind !== "checkout") deny$2("GIT_CHECKOUT_DENIED");
		const manifest = await this.manifest(commit, signal);
		if ((await this.call([
			"status",
			"--porcelain=v1",
			"-z",
			"--untracked-files=all"
		], signal)).out.length) deny$2("GIT_CHECKOUT_DIRTY");
		await this.call([
			"checkout",
			"--quiet",
			"--detach",
			sha(commit)
		], signal);
		return this.verifyCheckout(manifest, signal);
	}
	async verifyCheckout(manifest, signal) {
		if (this.identity.kind !== "checkout") deny$2("GIT_CHECKOUT_DENIED");
		await this.validate(signal);
		const parsed = sourceManifest.safeParse(manifest);
		if (!parsed.success) deny$2("GIT_SOURCE_MANIFEST_INVALID");
		manifest = parsed.data;
		const { sha256, ...basis } = manifest;
		if (sha256 !== hash$6(canonical(basis))) deny$2("GIT_SOURCE_MANIFEST_INVALID");
		for (const file of manifest.files) {
			if (signal?.aborted) deny$2("GIT_ABORTED");
			if (!safePath(file.path) || file.byteSize > 2 * 1024 * 1024) deny$2("GIT_SOURCE_PATH_DENIED");
			let path = this.identity.root;
			const parts = file.path.split("/");
			for (const [i, part] of parts.entries()) {
				path = join(path, part);
				const stat = await lstat(path, { bigint: true });
				if (stat.isSymbolicLink() || i < parts.length - 1 && !stat.isDirectory() || i === parts.length - 1 && (!stat.isFile() || stat.nlink !== 1n || stat.size !== BigInt(file.byteSize))) deny$2("GIT_WORKTREE_SOURCE_CHANGED");
				if (i === parts.length - 1) {
					const handle = await open(path, "r");
					try {
						const before = await handle.stat({ bigint: true });
						if (before.dev !== stat.dev || before.ino !== stat.ino || before.nlink !== 1n) deny$2("GIT_WORKTREE_SOURCE_CHANGED");
						const bytes = Buffer.alloc(file.byteSize + 1);
						let count = 0;
						while (count < bytes.length) {
							const result = await handle.read(bytes, count, bytes.length - count, null);
							if (!result.bytesRead) break;
							count += result.bytesRead;
						}
						const after = await handle.stat({ bigint: true });
						if (count !== file.byteSize || hash$6(bytes.subarray(0, count)) !== file.sha256 || before.mtimeNs !== after.mtimeNs || after.size !== BigInt(file.byteSize)) deny$2("GIT_WORKTREE_SOURCE_CHANGED");
					} finally {
						await handle.close();
					}
				}
			}
		}
		return manifest;
	}
	async checkoutAttempt(commit, attemptId, signal) {
		const branch = attemptRef(attemptId);
		await this.validate(signal);
		const previous = await this.call([
			"rev-parse",
			"--verify",
			branch
		], signal, void 0, void 0, true);
		if (previous.code === 0 && decode(previous.out).trim() !== sha(commit)) deny$2("GIT_ATTEMPT_BRANCH_CHANGED");
		const manifest = await this.checkout(commit, signal);
		if (previous.code !== 0) await this.call([
			"update-ref",
			branch,
			sha(commit),
			"0".repeat(40)
		], signal);
		await this.call([
			"symbolic-ref",
			"HEAD",
			branch
		], signal);
		await this.verifyAttemptBranch(commit, attemptId, signal);
		return manifest;
	}
	async verifyAttemptBranch(commit, attemptId, signal) {
		if (this.identity.kind !== "checkout") deny$2("GIT_CHECKOUT_DENIED");
		const branch = attemptRef(attemptId);
		await this.validate(signal);
		const [head, target] = await Promise.all([this.call([
			"symbolic-ref",
			"--quiet",
			"HEAD"
		], signal, void 0, void 0, true), this.call([
			"rev-parse",
			"--verify",
			branch
		], signal, void 0, void 0, true)]);
		if (head.code !== 0 || target.code !== 0 || decode(head.out).trim() !== branch || decode(target.out).trim() !== sha(commit)) deny$2("GIT_ATTEMPT_BRANCH_CHANGED");
	}
	async mergeBases(ours, theirs, signal) {
		sha(ours);
		sha(theirs);
		await this.validate(signal);
		const inputs = await Promise.allSettled([.../* @__PURE__ */ new Set([ours, theirs])].map((commit) => this.commit(commit, signal)));
		for (const input of inputs) if (input.status === "rejected") throw input.reason;
		const ancestors = await this.call([
			"merge-base",
			"--all",
			ours,
			theirs
		], signal, void 0, 8192, true);
		if (ancestors.code !== 0) deny$2("GIT_MERGE_BASE_CHANGED");
		const bases = decode(ancestors.out).trim().split("\n").map(sha).sort();
		if (!bases.length || bases.length > 64 || new Set(bases).size !== bases.length) deny$2("GIT_MERGE_BASE_CHANGED");
		const facts = await Promise.allSettled(bases.map((commit) => this.commit(commit, signal)));
		for (const fact of facts) if (fact.status === "rejected") throw fact.reason;
		return bases;
	}
	/** Creates objects only; the caller must journal facts and fence project refs. */
	async mergeTree(expectedBase, ours, theirs, signal) {
		const expected = (typeof expectedBase === "string" ? [expectedBase] : [...expectedBase]).map(sha).sort();
		if (!expected.length || expected.length > 64 || new Set(expected).size !== expected.length) deny$2("GIT_MERGE_BASE_CHANGED");
		const bases = await this.mergeBases(ours, theirs, signal);
		if (canonical(bases) !== canonical(expected)) deny$2("GIT_MERGE_BASE_CHANGED");
		const result = await this.call([
			"merge-tree",
			"--write-tree",
			"-z",
			"--messages",
			ours,
			theirs
		], signal, void 0, 1024 * 1024, true);
		if (result.code !== 0 && result.code !== 1) throw new WorkspaceError("GIT_MERGE_UNKNOWN", "unknown");
		if (result.out.at(-1) !== 0) deny$2("GIT_MERGE_OUTPUT_DENIED");
		const values = decode(result.out).split("\0"), tree = sha(values.shift() ?? "");
		const stages = [];
		while (values.length && values[0] !== "") {
			const match = /^(100644|100755) ([a-f0-9]{40}) ([123])\t(.+)$/.exec(values.shift());
			if (!match || !safePath(match[4]) || stages.length >= 6e3) deny$2("GIT_MERGE_OUTPUT_DENIED");
			stages.push({
				path: match[4],
				mode: match[1],
				objectId: match[2],
				stage: Number(match[3])
			});
		}
		if (values.shift() !== "") deny$2("GIT_MERGE_OUTPUT_DENIED");
		if (new Set(stages.map((s) => s.path + "\0" + s.stage)).size !== stages.length) deny$2("GIT_MERGE_OUTPUT_DENIED");
		const messages = [];
		while (values.length && !(values.length === 1 && values[0] === "")) {
			const countText = values.shift(), count = Number(countText);
			if (!/^[1-9][0-9]*$/.test(countText) || count > 2e3 || count + 2 > values.length || messages.length >= 2e3) deny$2("GIT_MERGE_OUTPUT_DENIED");
			const paths = values.splice(0, count), kind = values.shift(), message = values.shift();
			if (paths.some((p) => !safePath(p)) || !kind || kind.length > 256 || message.length > 65536) deny$2("GIT_MERGE_OUTPUT_DENIED");
			messages.push({
				paths,
				kind,
				message
			});
		}
		if (result.code === 0 && (stages.length || messages.some((m) => m.kind.startsWith("CONFLICT")))) deny$2("GIT_MERGE_OUTPUT_DENIED");
		await this.treeManifest(tree, signal);
		return {
			clean: result.code === 0,
			tree,
			base: bases.length === 1 ? bases[0] : null,
			bases,
			ours,
			theirs,
			stages,
			messages
		};
	}
	async writeCommit(body, signal) {
		if (body.length > 1e4 || body.includes("\0") || Buffer.from(body).toString("utf8") !== body) deny$2("GIT_COMMIT_INVALID");
		await this.validate(signal);
		const expected = createHash("sha1").update(Buffer.from("commit " + Buffer.byteLength(body) + "\0")).update(body).digest("hex");
		const commit = sha(decode((await this.call([
			"hash-object",
			"-t",
			"commit",
			"-w",
			"--stdin"
		], signal, Buffer.from(body), 8192)).out).trim());
		if (commit !== expected) throw new WorkspaceError("GIT_COMMIT_CHANGED", "unknown");
		if ((await this.commit(commit, signal)).body !== body) throw new WorkspaceError("GIT_COMMIT_CHANGED", "unknown");
		return commit;
	}
	async verifyPreservationBasis(base, expectedRefs, signal) {
		sha(base);
		for (const item of expectedRefs) {
			if (item.ref.startsWith("refs/heads/devmesh/")) attemptRef(item.ref.slice(19));
			else ref(item.ref);
			sha(item.commit);
		}
		if (this.identity.kind !== "checkout" || expectedRefs.length > 66 || new Set(expectedRefs.map((item) => item.ref)).size !== expectedRefs.length) deny$2("GIT_PRESERVATION_BASIS_INVALID");
		await this.validate(signal);
		const listed = decode((await this.call(["for-each-ref", "--format=%(refname)%00%(objectname)%00%(symref)"], signal, void 0, 256 * 1024)).out).split("\n").filter(Boolean).map((line) => {
			const [name, commit, symbolic, ...extra] = line.replace(/\r$/, "").split("\0");
			if (!name || !commit || symbolic !== "" || extra.length) deny$2("GIT_PRESERVATION_REF_INVALID");
			sha(commit);
			return {
				ref: name,
				commit
			};
		});
		const order = (a, b) => a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
		if (canonical(listed.sort(order)) !== canonical([...expectedRefs].sort(order))) deny$2("GIT_PRESERVATION_UNRETAINED_REF");
		if ((await this.call([
			"diff-index",
			"--cached",
			"--quiet",
			base,
			"--"
		], signal, void 0, void 0, true)).code !== 0) deny$2("GIT_PRESERVATION_INDEX_CHANGED");
	}
	async readRef(name, signal) {
		ref(name);
		await this.validate(signal);
		const r = await this.call([
			"rev-parse",
			"--verify",
			name
		], signal, void 0, void 0, true);
		return r.code === 0 ? sha(decode(r.out).trim()) : null;
	}
	async head(signal) {
		await this.validate(signal);
		const r = await this.call([
			"rev-parse",
			"--verify",
			"HEAD"
		], signal, void 0, void 0, true);
		return r.code === 0 ? sha(decode(r.out).trim()) : null;
	}
	async updateRefs(updates, signal) {
		if (!updates.length || updates.length > 8 || new Set(updates.map((u) => u.ref)).size !== updates.length) deny$2("GIT_REF_DENIED");
		await this.validate(signal);
		const input = "start\n" + updates.map((u) => "update " + ref(u.ref) + " " + sha(u.commit) + " " + (u.expected === null ? "0".repeat(40) : sha(u.expected)) + "\n").join("") + "prepare\ncommit\n";
		return (await this.call(["update-ref", "--stdin"], signal, Buffer.from(input), void 0, true)).code === 0;
	}
};
//#endregion
//#region src/allocation.ts
const fail$6 = (code) => {
	throw new WorkspaceError(code);
};
async function exists$1(path) {
	try {
		await lstat(path);
		return true;
	} catch (e) {
		if (e.code === "ENOENT") return false;
		throw e;
	}
}
async function facts(provider) {
	await provider.validate();
	const { root, gitDirectory, commonDirectory } = provider.identity, [r, g] = await Promise.all([lstat(root, { bigint: true }), lstat(gitDirectory, { bigint: true })]);
	return {
		root,
		gitDirectory,
		commonDirectory,
		rootDevice: String(r.dev),
		rootFileId: String(r.ino),
		gitDevice: String(g.dev),
		gitFileId: String(g.ino)
	};
}
/** Explicit local transport, with mandatory external fencing; never a CLI fallback. */
var LocalManagedWorkspaces = class {
	options;
	controlDataRoot;
	runnerDataRoot;
	#templates;
	constructor(options) {
		this.options = options;
		if (options.mode !== "local-development" || !options.fencer || typeof options.fencer.acquire !== "function") fail$6("WORKSPACE_BACKEND_NOT_CONFIGURED");
		this.controlDataRoot = canonicalRoot(options.controlDataRoot);
		this.runnerDataRoot = canonicalRoot(options.runnerDataRoot);
		const backup = canonicalRoot(options.backupRoot);
		assertSeparate([
			this.controlDataRoot,
			this.runnerDataRoot,
			backup
		]);
		opaqueKey.parse(options.runnerId);
		this.#templates = new Map(options.templates);
	}
	async parent(root, section, id, basis, allowCreate) {
		opaqueKey.parse(id);
		const top = join(root, section);
		if (!await exists$1(top)) {
			if (!allowCreate) fail$6("WORKSPACE_DIRECTORY_MISSING");
			try {
				await mkdir(top, { recursive: false });
			} catch (e) {
				if (e.code !== "EEXIST") throw e;
			}
		}
		canonicalRoot(top);
		const parent = join(top, id);
		let created = false;
		if (!await exists$1(parent)) {
			if (!allowCreate) fail$6("WORKSPACE_DIRECTORY_MISSING");
			try {
				await mkdir(parent, { recursive: false });
				created = true;
			} catch (e) {
				if (e.code !== "EEXIST") throw e;
			}
		}
		canonicalRoot(parent);
		const stat = await lstat(parent, { bigint: true }), expected = canonical({
			schemaVersion: "devmesh.code-directory.v1",
			section,
			id,
			operationId: basis.operationId,
			requestHash: basis.requestHash,
			device: String(stat.dev),
			fileId: String(stat.ino)
		}), marker = join(parent, "code-directory.json");
		if (created) {
			const handle = await open(marker, "wx", 384);
			try {
				await handle.writeFile(expected);
				await handle.sync();
			} finally {
				await handle.close();
			}
		}
		if (!await exists$1(marker)) fail$6("WORKSPACE_DIRECTORY_UNOWNED");
		const m = await lstat(marker);
		if (!m.isFile() || m.isSymbolicLink() || m.nlink !== 1 || m.size > 16384 || await readFile(marker, "utf8") !== expected) fail$6("WORKSPACE_DIRECTORY_UNOWNED");
		return parent;
	}
	async retained(destination, source, commit, operationId, signal) {
		const reference = "refs/devmesh/allocations/" + opaqueKey.parse(operationId), original = await destination.readRef(reference, signal), expected = await source.manifest(commit, signal);
		if (original !== null && original !== commit) fail$6("WORKSPACE_SOURCE_REF_CHANGED");
		if (original === null) {
			await destination.importCommit(await source.exportCommit(commit, signal), commit, signal);
			if (!await destination.updateRefs([{
				ref: reference,
				commit,
				expected: null
			}], signal) && await destination.readRef(reference, signal) !== commit) fail$6("WORKSPACE_SOURCE_REF_CHANGED");
		}
		const actual = await destination.manifest(commit, signal);
		if (actual.sha256 !== expected.sha256) fail$6("WORKSPACE_SOURCE_CHANGED");
		return actual;
	}
	async ensureRepository(input, signal = new AbortController().signal) {
		const pending = await this.options.storage.request("beginManagedRepository", input), source = this.#templates.get(pending.templateCommit);
		if (!source) fail$6("WORKSPACE_TEMPLATE_NOT_CONFIGURED");
		const fence = await this.options.fencer.acquire({
			kind: "project",
			directoryRoot: this.controlDataRoot,
			resourceId: pending.resourceId,
			operationId: pending.operationId
		}, signal);
		try {
			const path = join(await this.parent(this.controlDataRoot, "repositories", pending.projectId, pending, pending.state !== "READY"), "repo.git");
			if (pending.state === "READY" && !await exists$1(path)) fail$6("WORKSPACE_DIRECTORY_MISSING");
			const provider = await exists$1(path) ? await ControlledGit.open(path, "bare") : await ControlledGit.initialize(path, "bare");
			if (pending.state === "READY") {
				if (canonical(await facts(provider)) !== canonical(pending.identity) || await provider.readRef("refs/devmesh/allocations/" + pending.operationId, signal) !== pending.templateCommit || !pending.manifest || (await provider.manifest(pending.templateCommit, signal)).sha256 !== pending.manifest.sha256) fail$6("WORKSPACE_REPOSITORY_CHANGED");
				return {
					record: pending,
					provider
				};
			}
			const manifest = await this.retained(provider, source, pending.templateCommit, pending.operationId, signal);
			return {
				record: await this.options.storage.request("completeManagedRepository", {
					operationId: pending.operationId,
					requestHash: pending.requestHash,
					identity: await facts(provider),
					manifest
				}),
				provider
			};
		} finally {
			await fence.release();
		}
	}
	async allocate(input, signal = new AbortController().signal) {
		if (input.runnerId !== this.options.runnerId) fail$6("WORKSPACE_RUNNER_CHANGED");
		const pending = await this.options.storage.request("beginWorkspaceAllocation", input), fence = await this.options.fencer.acquire({
			kind: "workspace",
			directoryRoot: this.runnerDataRoot,
			resourceId: pending.workspaceRef,
			operationId: pending.operationId,
			permit: input.permit
		}, signal);
		try {
			if (pending.state !== "READY") await this.options.storage.request("authorizeWorkspaceAllocation", {
				permit: input.permit,
				operationId: pending.operationId
			});
			const project = await this.options.storage.request("getAllocationRepository", {
				permit: input.permit,
				operationId: pending.operationId
			});
			if (project.state !== "READY" || !project.identity) fail$6("MANAGED_REPOSITORY_UNAVAILABLE");
			const source = await ControlledGit.open(project.identity.root, "bare");
			if (canonical(await facts(source)) !== canonical(project.identity)) fail$6("WORKSPACE_REPOSITORY_CHANGED");
			const path = join(await this.parent(this.runnerDataRoot, "workspaces", pending.attemptId, pending, pending.state !== "READY"), "repo");
			if (pending.state === "READY" && !await exists$1(path)) fail$6("WORKSPACE_DIRECTORY_MISSING");
			const provider = await exists$1(path) ? await ControlledGit.open(path, "checkout") : await ControlledGit.initialize(path, "checkout");
			if (pending.state === "READY") {
				await provider.verifyAttemptBranch(pending.baseCommit, pending.attemptId, signal);
				if (canonical(await facts(provider)) !== canonical(pending.identity) || await provider.head(signal) !== pending.baseCommit || await provider.readRef("refs/devmesh/allocations/" + pending.operationId, signal) !== pending.baseCommit || !pending.manifest || (await provider.manifest(pending.baseCommit, signal)).sha256 !== pending.manifest.sha256) fail$6("WORKSPACE_DIRECTORY_CHANGED");
				return {
					record: pending,
					provider
				};
			}
			const manifest = await this.retained(provider, source, pending.baseCommit, pending.operationId, signal);
			await this.options.storage.request("authorizeWorkspaceAllocation", {
				permit: input.permit,
				operationId: pending.operationId
			});
			await provider.checkoutAttempt(pending.baseCommit, pending.attemptId, signal);
			return {
				record: await this.options.storage.request("completeWorkspaceAllocation", {
					operationId: pending.operationId,
					requestHash: pending.requestHash,
					identity: await facts(provider),
					manifest
				}),
				provider
			};
		} catch (error) {
			await this.options.storage.request("markWorkspaceAllocationUncertain", {
				operationId: pending.operationId,
				requestHash: pending.requestHash,
				errorCode: error instanceof WorkspaceError ? error.code : "WORKSPACE_PREPARATION_UNKNOWN"
			}).catch(() => {});
			throw error;
		} finally {
			await fence.release();
		}
	}
	static repositoryOperation(projectId, templateCommit) {
		return "op_" + createHash("sha256").update(projectId + "\0" + templateCommit).digest("hex");
	}
};
//#endregion
//#region src/fencing.ts
var LocalRunnerWorkspaceFencer = class {
	options;
	controlDataRoot;
	runnerDataRoot;
	#recovery;
	constructor(options) {
		this.options = options;
		if (options.mode !== "local-development" || ![
			"localhost",
			"127.0.0.1",
			"[::1]"
		].includes(options.runner.base.hostname)) throw new WorkspaceError("WORKSPACE_LOCAL_FENCING_REQUIRED");
		this.controlDataRoot = canonicalRoot(options.controlDataRoot);
		this.runnerDataRoot = canonicalRoot(options.runnerDataRoot);
		assertSeparate([
			this.controlDataRoot,
			this.runnerDataRoot,
			canonicalRoot(options.backupRoot)
		]);
		this.#recovery = new Map(options.recoveryTokens);
	}
	async active(workspaceRef) {
		try {
			return await this.options.runner.activeWorkspaceFence(workspaceRef);
		} catch (e) {
			if (e.status === 404) return null;
			throw e;
		}
	}
	async releaseRunner(fence) {
		let observed;
		try {
			observed = await this.options.runner.releaseWorkspaceFence(fence.fenceId, {
				holderToken: fence.holderToken,
				requestHash: fence.requestHash
			});
		} catch (error) {
			try {
				observed = await this.options.runner.getWorkspaceFence(fence.fenceId);
			} catch {
				throw error;
			}
			if (observed.state !== "RELEASED") throw error;
		}
		if (observed.fenceId !== fence.fenceId || observed.holderToken !== fence.holderToken || observed.requestHash !== fence.requestHash || observed.state !== "RELEASED") throw new WorkspaceError("WORKSPACE_FENCE_RELEASE_UNKNOWN", "unknown");
	}
	async acquire(input, signal) {
		opaqueKey.parse(input.resourceId);
		opaqueKey.parse(input.operationId);
		if (signal.aborted) throw new WorkspaceError("GIT_ABORTED");
		if (!["project", "workspace"].includes(input.kind) || await realpath(canonicalRoot(input.directoryRoot)) !== await realpath(input.kind === "project" ? this.controlDataRoot : this.runnerDataRoot)) throw new WorkspaceError("WORKSPACE_FENCE_ROOT_CHANGED");
		const lockRoot = join(input.kind === "project" ? this.controlDataRoot : this.runnerDataRoot, input.kind === "project" ? "locks" : "registry", "code-locks");
		canonicalRoot(lockRoot);
		await mkdir(lockRoot, {
			recursive: true,
			mode: 448
		});
		canonicalRoot(lockRoot);
		const recovery = this.#recovery.get(input.kind + ":" + input.resourceId), lock = acquireWriterLock(join(lockRoot, input.resourceId), recovery);
		let fence;
		try {
			if (input.kind === "workspace") {
				if (!input.permit || input.permit.ownerKind !== "workflowAttempt") throw new WorkspaceError("WORKSPACE_PERMIT_REQUIRED");
				const expected = join(await realpath(this.runnerDataRoot), "workspaces", input.permit.attemptId, "repo");
				const old = await this.active(input.resourceId);
				if (old) {
					if (!recovery || old.holderToken !== recovery || old.workspacePath !== expected) throw new WorkspaceError("WORKSPACE_FENCE_RECOVERY_REQUIRED");
					await this.releaseRunner(old);
				}
				const request = acquireWorkspaceFence.parse({
					operationId: "op_" + randomUUID().replaceAll("-", ""),
					parentOperationId: input.operationId,
					workspaceRef: input.resourceId,
					permit: structuredClone(input.permit),
					holderToken: lock.token,
					...input.purpose ? { purpose: input.purpose } : {}
				});
				try {
					fence = await this.options.runner.acquireWorkspaceFence(request);
				} catch (error) {
					try {
						fence = await this.options.runner.workspaceFenceByOperation(request.operationId);
					} catch {
						throw error;
					}
				}
				if (!fence || fence.operationId !== request.operationId || fence.workspaceRef !== input.resourceId || fence.workspacePath !== expected || fence.holderToken !== lock.token || fence.state !== "ACTIVE" || canonical(fence.request) !== canonical(request)) throw new WorkspaceError("WORKSPACE_FENCE_ACQUIRE_UNKNOWN", "unknown");
			}
			if (signal.aborted) {
				if (fence) await this.releaseRunner(fence);
				throw new WorkspaceError("GIT_ABORTED");
			}
			let released = false;
			return { release: async () => {
				if (released) return;
				if (fence) await this.releaseRunner(fence);
				lock.release();
				released = true;
			} };
		} catch (error) {
			lock.release();
			throw error;
		}
	}
};
/** Trusted Repo MCP adapter: consistent project→workspace lock order and Runner admission barrier. */
function createLocalRepoAcquire(fencer) {
	return async (binding, signal, access) => {
		if (access.permit.ownerKind !== "workflowAttempt" || access.permit.attemptId !== binding.attemptId || await realpath(binding.root) !== join(await realpath(fencer.runnerDataRoot), "workspaces", binding.attemptId, "repo")) throw new WorkspaceError("WORKSPACE_REPO_BINDING_CHANGED");
		const project = await fencer.acquire({
			kind: "project",
			directoryRoot: fencer.controlDataRoot,
			resourceId: binding.projectResourceId,
			operationId: access.operationId
		}, signal);
		try {
			const workspace = await fencer.acquire({
				kind: "workspace",
				directoryRoot: fencer.runnerDataRoot,
				resourceId: binding.resourceId,
				operationId: access.operationId,
				permit: access.permit,
				purpose: access.purpose === "reconcile" ? "cleanup" : "write"
			}, signal);
			let released = false;
			return { release: async () => {
				if (released) return;
				await workspace.release();
				await project.release();
				released = true;
			} };
		} catch (error) {
			await project.release();
			throw error;
		}
	};
}
//#endregion
//#region src/source-archives.ts
function deny$1(code) {
	throw new WorkspaceError(code);
}
async function identity$2(provider) {
	await provider.validate();
	const { root, gitDirectory, commonDirectory } = provider.identity, [r, g] = await Promise.all([lstat(root, { bigint: true }), lstat(gitDirectory, { bigint: true })]);
	return {
		root,
		gitDirectory,
		commonDirectory,
		rootDevice: String(r.dev),
		rootFileId: String(r.ino),
		gitDevice: String(g.dev),
		gitFileId: String(g.ino)
	};
}
/** Source-object retention only. This ACK never authorizes workspace deletion. */
var LocalSourceArchives = class {
	options;
	controlDataRoot;
	runnerDataRoot;
	constructor(options) {
		this.options = options;
		if (options.mode !== "local-development" || !options.fencer || typeof options.fencer.acquire !== "function") deny$1("SOURCE_ARCHIVE_BACKEND_NOT_CONFIGURED");
		this.controlDataRoot = canonicalRoot(options.controlDataRoot);
		this.runnerDataRoot = canonicalRoot(options.runnerDataRoot);
		assertSeparate([
			this.controlDataRoot,
			this.runnerDataRoot,
			canonicalRoot(options.backupRoot)
		]);
	}
	async project(record) {
		const r = record.basis.repository;
		if (!r.identity || r.identity.root !== join(await realpath(this.controlDataRoot), "repositories", r.projectId, "repo.git")) deny$1("SOURCE_ARCHIVE_REPOSITORY_CHANGED");
		const provider = await ControlledGit.open(r.identity.root, "bare");
		if (canonical(await identity$2(provider)) !== canonical(r.identity)) deny$1("SOURCE_ARCHIVE_REPOSITORY_CHANGED");
		return provider;
	}
	async source(record) {
		const a = record.basis.allocation;
		if (!a.identity || a.identity.root !== join(await realpath(this.runnerDataRoot), "workspaces", a.attemptId, "repo")) deny$1("SOURCE_ARCHIVE_WORKSPACE_CHANGED");
		const provider = await ControlledGit.open(a.identity.root, "checkout");
		if (canonical(await identity$2(provider)) !== canonical(a.identity)) deny$1("SOURCE_ARCHIVE_WORKSPACE_CHANGED");
		return provider;
	}
	async acknowledge(record, permit, project, signal) {
		const m = record.manifest;
		if (!m) throw new WorkspaceError("SOURCE_ARCHIVE_UNPREPARED", "unknown");
		const archiveRef = "refs/devmesh/source-archives/" + record.operationId, sourceRef = "refs/devmesh/sources/" + m.commit;
		if (await project.readRef(archiveRef, signal) !== m.commit || await project.readRef(sourceRef, signal) !== m.commit) throw new WorkspaceError("SOURCE_ARCHIVE_RETENTION_UNKNOWN", "unknown");
		if (canonical(await project.manifest(m.commit, signal)) !== canonical(m)) throw new WorkspaceError("SOURCE_ARCHIVE_SOURCE_CHANGED", "unknown");
		const acknowledgement = {
			commit: m.commit,
			tree: m.tree,
			manifestSha256: m.sha256,
			repositoryIdentity: await identity$2(project),
			archiveRef,
			sourceRef
		};
		try {
			return await this.options.storage.request("completeSourceArchive", {
				permit,
				operationId: record.operationId,
				requestHash: record.requestHash,
				acknowledgement
			});
		} catch (error) {
			const original = await this.options.storage.request("getSourceArchive", {
				permit,
				operationId: record.operationId
			}).catch(() => null);
			if (original?.state === "ACKNOWLEDGED" && canonical(original.acknowledgement) === canonical(acknowledgement)) return original;
			throw error;
		}
	}
	async archive(input, signal = new AbortController().signal) {
		let record = await this.options.storage.request("beginSourceArchive", input);
		if (["ACKNOWLEDGED", "FAILED"].includes(record.state)) return record;
		let projectFence, workspaceFence, transferring = false;
		try {
			projectFence = await this.options.fencer.acquire({
				kind: "project",
				directoryRoot: this.controlDataRoot,
				resourceId: record.basis.repository.resourceId,
				operationId: record.operationId
			}, signal);
			workspaceFence = await this.options.fencer.acquire({
				kind: "workspace",
				directoryRoot: this.runnerDataRoot,
				resourceId: record.workspaceRef,
				operationId: record.operationId,
				permit: input.permit,
				purpose: "cleanup"
			}, signal);
			await this.options.storage.request("assertRepoWorkspaceSettled", {
				permit: input.permit,
				workspaceRef: record.workspaceRef
			});
			const project = await this.project(record);
			if (!record.created) return await this.acknowledge(record, input.permit, project, signal);
			const source = await this.source(record), prepared = record.basis.commitOperation.prepared, base = record.basis.allocation.baseCommit, info = await source.commit(prepared.commit, signal);
			if (info.body !== prepared.commitBody || info.body.length > 1e4 || info.tree !== prepared.tree || info.parents.length !== 1 || info.parents[0] !== base || await source.readRef(prepared.ref, signal) !== prepared.commit) deny$1("SOURCE_ARCHIVE_COMMIT_CHANGED");
			const changed = await source.changedPaths(base, info.commit, signal), scope = record.basis.allocation.scope;
			if (changed.some((path) => !scope.some((s) => path === s || path.startsWith(s + "/")))) deny$1("SOURCE_ARCHIVE_SCOPE_DENIED");
			const manifest = await source.manifest(info.commit, signal);
			record = {
				...record,
				...await this.options.storage.request("prepareSourceArchive", {
					permit: input.permit,
					operationId: record.operationId,
					requestHash: record.requestHash,
					manifest
				})
			};
			transferring = true;
			await project.importCommit(await source.exportCommit(info.commit, signal), info.commit, signal);
			if (canonical(await project.manifest(info.commit, signal)) !== canonical(manifest)) throw new WorkspaceError("SOURCE_ARCHIVE_SOURCE_CHANGED", "unknown");
			const archiveRef = "refs/devmesh/source-archives/" + record.operationId, sourceRef = "refs/devmesh/sources/" + info.commit, old = await project.readRef(sourceRef, signal);
			if (old !== null && old !== info.commit) throw new WorkspaceError("SOURCE_ARCHIVE_REF_CHANGED", "unknown");
			await project.updateRefs([{
				ref: archiveRef,
				commit: info.commit,
				expected: null
			}, {
				ref: sourceRef,
				commit: info.commit,
				expected: old
			}], signal);
			return await this.acknowledge(record, input.permit, project, signal);
		} catch (error) {
			const errorCode = error instanceof WorkspaceError ? error.code : "SOURCE_ARCHIVE_OUTCOME_UNKNOWN";
			if (record.created && record.state === "SENT" && !transferring && (!workspaceFence || error instanceof WorkspaceError && error.outcome === "not-sent")) await this.options.storage.request("failSourceArchive", {
				permit: input.permit,
				operationId: record.operationId,
				requestHash: record.requestHash,
				errorCode
			}).catch(() => {});
			else await this.options.storage.request("markSourceArchiveUncertain", {
				permit: input.permit,
				operationId: record.operationId,
				requestHash: record.requestHash,
				errorCode
			}).catch(() => {});
			throw error;
		} finally {
			if (workspaceFence) await workspaceFence.release();
			if (projectFence) await projectFence.release();
		}
	}
	async reconcile(input, signal = new AbortController().signal) {
		const record = await this.options.storage.request("getSourceArchive", input);
		return this.archive({
			...input,
			allocationOperationId: record.allocationOperationId,
			commitOperationId: record.commitOperationId
		}, signal);
	}
};
//#endregion
//#region src/candidate-integrations.ts
function deny(code) {
	throw new WorkspaceError(code, "unknown");
}
const hash$5 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const original = (r) => ({
	principalId: r.principalId,
	operationId: r.operationId,
	requestHash: r.requestHash
});
const query = (r) => ({
	principalId: r.principalId,
	operationId: r.operationId
});
async function identity$1(provider) {
	await provider.validate();
	const { root, gitDirectory, commonDirectory } = provider.identity, [r, g] = await Promise.all([lstat(root, { bigint: true }), lstat(gitDirectory, { bigint: true })]);
	return {
		root,
		gitDirectory,
		commonDirectory,
		rootDevice: String(r.dev),
		rootFileId: String(r.ino),
		gitDevice: String(g.dev),
		gitFileId: String(g.ino)
	};
}
/** Explicit local project service. No model-controlled SHA, argv or Host resurrection. */
var LocalCandidateIntegrations = class {
	options;
	controlDataRoot;
	constructor(options) {
		this.options = options;
		if (options.mode !== "local-development" || typeof options.fencer?.acquire !== "function") throw new WorkspaceError("CANDIDATE_BACKEND_NOT_CONFIGURED");
		this.controlDataRoot = canonicalRoot(options.controlDataRoot);
		assertSeparate([
			this.controlDataRoot,
			canonicalRoot(options.runnerDataRoot),
			canonicalRoot(options.backupRoot)
		]);
	}
	async project(basis) {
		const expected = join(await realpath(this.controlDataRoot), "repositories", basis.projectId, "repo.git");
		if (basis.repository.identity.root !== expected) deny("CANDIDATE_REPOSITORY_CHANGED");
		const provider = await ControlledGit.open(expected, "bare");
		if (canonical(await identity$1(provider)) !== canonical(basis.repository.identity)) deny("CANDIDATE_REPOSITORY_CHANGED");
		return provider;
	}
	async source(provider, source, signal) {
		if (await provider.readRef(source.archiveRef, signal) !== source.commit || await provider.readRef(source.sourceRef, signal) !== source.commit) deny("CANDIDATE_SOURCE_RETENTION_UNPROVEN");
		const commit = await provider.commit(source.commit, signal), manifest = await provider.manifest(source.commit, signal);
		if (commit.parents.length !== 1 || commit.parents[0] !== source.baseCommit || commit.tree !== source.tree || manifest.sha256 !== source.manifestSha256) deny("CANDIDATE_SOURCE_CHANGED");
	}
	async acknowledgeStep(record, basis, step, provider, signal) {
		const p = step.preparation;
		if (!p?.clean || !p.commit || !p.commitBody || !p.ref) deny("CANDIDATE_STEP_UNPREPARED");
		if (await provider.readRef(p.ref, signal) !== p.commit) deny("CANDIDATE_STEP_OUTCOME_UNKNOWN");
		const commit = await provider.commit(p.commit, signal);
		if (commit.body !== p.commitBody || commit.tree !== p.tree || canonical(commit.parents) !== canonical([step.ours, step.theirs])) deny("CANDIDATE_STEP_PROOF_CHANGED");
		const proof = {
			repositoryIdentity: await identity$1(provider),
			commit: p.commit,
			tree: p.tree,
			ref: p.ref
		};
		if (canonical(proof.repositoryIdentity) !== canonical(basis.repository.identity)) deny("CANDIDATE_REPOSITORY_CHANGED");
		try {
			return await this.options.storage.request("acknowledgeCandidateStep", {
				...original(record),
				ordinal: step.ordinal,
				proof
			});
		} catch (error) {
			const old = await this.options.storage.request("getCandidateIntegrationStep", {
				...query(record),
				ordinal: step.ordinal
			}).catch(() => null);
			if (old?.state === "ACKNOWLEDGED" && canonical(old.acknowledgement) === canonical(proof)) return old;
			throw error;
		}
	}
	async acknowledge(record, basis, provider, signal) {
		const manifest = await this.options.storage.request("getCandidateIntegrationManifest", query(record));
		if (!manifest) deny("CANDIDATE_INTEGRATION_UNPREPARED");
		for (const update of record.updates.filter((update) => update.expected === null && !update.ref.startsWith("refs/devmesh/candidates/"))) if (await provider.readRef(update.ref, signal) !== update.commit) deny("CANDIDATE_CAS_OUTCOME_UNKNOWN");
		if (canonical(await provider.manifest(manifest.commit, signal)) !== canonical(manifest)) deny("CANDIDATE_MANIFEST_CHANGED");
		const acknowledgement = {
			repositoryIdentity: await identity$1(provider),
			refs: record.updates.map(({ ref, commit }) => ({
				ref,
				commit
			})),
			manifestSha256: manifest.sha256
		};
		if (canonical(acknowledgement.repositoryIdentity) !== canonical(basis.repository.identity)) deny("CANDIDATE_REPOSITORY_CHANGED");
		try {
			return await this.options.storage.request("acknowledgeCandidateIntegration", {
				...original(record),
				acknowledgement
			});
		} catch (error) {
			const old = await this.options.storage.request("getCandidateIntegration", query(record)).catch(() => null);
			if (old?.state === "ACKNOWLEDGED" && canonical(old.acknowledgement) === canonical(acknowledgement)) return old;
			throw error;
		}
	}
	async retainedInput(record, provider, signal) {
		if (!record.originOperationId) deny("CANDIDATE_PROMOTION_UNPROVEN");
		const input = {
			principalId: record.principalId,
			operationId: record.originOperationId
		}, origin = await this.options.storage.request("getCandidateIntegration", input), basis = await this.options.storage.request("getCandidateIntegrationBasis", input);
		if (origin.state !== "ACKNOWLEDGED" || origin.purpose !== "work-input" || origin.originOperationId || !origin.manifest) deny("CANDIDATE_PROMOTION_UNPROVEN");
		for (const source of basis.sources) await this.source(provider, source, signal);
		for (const ref of origin.updates) if (ref.ref.startsWith("refs/devmesh/candidates/") || await provider.readRef(ref.ref, signal) !== ref.commit) deny("CANDIDATE_SNAPSHOT_REF_CHANGED");
		for (let ordinal = 0; ordinal < basis.sources.length; ordinal++) {
			const step = await this.options.storage.request("getCandidateIntegrationStep", {
				...input,
				ordinal
			});
			if (!step || step.state !== "ACKNOWLEDGED") deny("CANDIDATE_PROMOTION_UNPROVEN");
			await this.acknowledgeStep(origin, basis, step, provider, signal);
		}
		const manifest = await provider.manifest(origin.manifest.commit, signal), retained = await this.options.storage.request("getCandidateIntegrationManifest", input);
		if (canonical(manifest) !== canonical(retained)) deny("CANDIDATE_MANIFEST_CHANGED");
		return manifest;
	}
	async integrate(input, signal = new AbortController().signal) {
		const { created: _created, ...initial } = await this.options.storage.request("beginCandidateIntegration", input);
		let record = initial;
		if ([
			"ACKNOWLEDGED",
			"CONFLICT",
			"FAILED"
		].includes(record.state)) return record;
		const basis = await this.options.storage.request("getCandidateIntegrationBasis", query(record));
		let fence;
		try {
			fence = await this.options.fencer.acquire({
				kind: "project",
				directoryRoot: this.controlDataRoot,
				resourceId: basis.repository.resourceId,
				operationId: record.operationId
			}, signal);
			const provider = await this.project(basis);
			if (record.state === "CONFLICT_PENDING") {
				const ordinal = record.acknowledgedSteps, step = await this.options.storage.request("getCandidateIntegrationStep", {
					...query(record),
					ordinal
				});
				if (!step || step.state !== "CONFLICT_PENDING") deny("CANDIDATE_CONFLICT_UNPROVEN");
				return this.options.conflicts ? await this.options.conflicts.reconcile({
					record,
					basis,
					step,
					repository: provider,
					signal
				}) : record;
			}
			if (record.originOperationId && ["BUILDING", "PREPARED"].includes(record.state)) {
				const manifest = await this.retainedInput(record, provider, signal);
				record = await this.options.storage.request("prepareCandidateIntegration", {
					...original(record),
					manifest
				});
			}
			for (let ordinal = 0; record.state === "BUILDING" && ordinal < basis.sources.length; ordinal++) {
				let step = await this.options.storage.request("getCandidateIntegrationStep", {
					...query(record),
					ordinal
				}), created = false;
				if (step?.state === "ACKNOWLEDGED") continue;
				if (!step) {
					await this.source(provider, basis.sources[ordinal], signal);
					const begun = await this.options.storage.request("beginCandidateStep", {
						...original(record),
						ordinal
					});
					step = begun;
					created = begun.created;
				}
				if (step.state === "COMPUTING") {
					const context = {
						record,
						basis,
						step,
						repository: provider,
						signal
					};
					let merge;
					if (created) {
						const bases = await provider.mergeBases(step.ours, step.theirs, signal);
						merge = await provider.mergeTree(bases, step.ours, step.theirs, signal);
						if (this.options.conflicts) await this.options.conflicts.capture(context, merge);
					} else {
						const originalReport = await this.options.conflicts?.recoverReport(context);
						if (!originalReport) deny("CANDIDATE_COMPUTATION_OUTCOME_UNKNOWN");
						merge = originalReport;
					}
					const reportSha256 = hash$5(canonical(merge));
					try {
						step = await this.options.storage.request("prepareCandidateStep", {
							...original(record),
							ordinal,
							bases: merge.bases,
							tree: merge.tree,
							clean: merge.clean,
							reportSha256
						});
					} catch (error) {
						const old = await this.options.storage.request("getCandidateIntegrationStep", {
							...query(record),
							ordinal
						}).catch(() => null);
						if (!old?.preparation || old.preparation.reportSha256 !== reportSha256 || old.preparation.tree !== merge.tree || old.preparation.clean !== merge.clean) throw error;
						step = old;
					}
					if (!merge.clean) {
						record = await this.options.storage.request("getCandidateIntegration", query(record));
						if (!this.options.conflicts) deny("CANDIDATE_CONFLICT_STORAGE_REQUIRED");
						return await this.options.conflicts.publish({
							record,
							basis,
							step,
							repository: provider,
							signal
						}, merge);
					}
				}
				const p = step.preparation;
				if (!p?.clean || !p.commit || !p.commitBody || !p.ref) deny("CANDIDATE_STEP_UNPREPARED");
				if ((await this.options.storage.request("markCandidateStepSent", {
					...original(record),
					ordinal
				})).send) {
					if (await provider.writeCommit(p.commitBody, signal) !== p.commit) deny("CANDIDATE_COMMIT_CHANGED");
					await provider.updateRefs([{
						ref: p.ref,
						commit: p.commit,
						expected: null
					}], signal);
				}
				await this.acknowledgeStep(record, basis, step, provider, signal);
			}
			record = await this.options.storage.request("getCandidateIntegration", query(record));
			if (record.state === "BUILDING") {
				const commit = (basis.sources.length ? await this.options.storage.request("getCandidateIntegrationStep", {
					...query(record),
					ordinal: basis.sources.length - 1
				}) : null)?.preparation?.commit ?? basis.baseCommit;
				record = await this.options.storage.request("prepareCandidateIntegration", {
					...original(record),
					manifest: await provider.manifest(commit, signal)
				});
			}
			const sent = await this.options.storage.request("markCandidateIntegrationSent", original(record));
			record = sent;
			if (sent.send && !await provider.updateRefs(record.updates, signal)) {
				const originals = record.updates.filter((update) => !update.ref.startsWith("refs/devmesh/candidates/"));
				let absent = true;
				for (const ref of originals) if (await provider.readRef(ref.ref, signal) !== null) absent = false;
				if (absent) {
					const global = record.updates.find((update) => update.ref.startsWith("refs/devmesh/candidates/"));
					return await this.options.storage.request("recordCandidateCasRejection", {
						...original(record),
						originalRefsAbsent: true,
						gitChildExited: true,
						observedHead: global ? await provider.readRef(global.ref, signal) : null
					});
				}
			}
			return await this.acknowledge(record, basis, provider, signal);
		} catch (error) {
			const code = error?.code, errorCode = typeof code === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(code) ? code : "CANDIDATE_OUTCOME_UNKNOWN";
			if (!await this.options.storage.request("failUnsentCandidateIntegration", {
				...original(record),
				errorCode
			}).catch(() => null)) await this.options.storage.request("markCandidateIntegrationUncertain", {
				...original(record),
				errorCode
			}).catch(() => {});
			throw error;
		} finally {
			if (fence) await fence.release();
		}
	}
	/** Prepare a dependency-specific snapshot before scheduler admission. This is
	* a trusted hook, separate from its read-only resource planner. */
	async prepareWorkInput(input, signal = new AbortController().signal) {
		const subject = {
			...input,
			purpose: "work-input"
		}, basis = await this.options.storage.request("getCandidateSourceBasis", subject);
		if (basis.sources.length === 0) return;
		let snapshot;
		try {
			snapshot = await this.options.storage.request("getQualifiedCandidateSnapshot", subject);
		} catch (error) {
			if (error?.code !== "CANDIDATE_SNAPSHOT_UNAVAILABLE") throw error;
			const operationId = "op_" + hash$5(canonical({
				principalId: input.principalId,
				basisSha256: basis.sha256
			})).slice(0, 32);
			snapshot = await this.integrate({
				...subject,
				operationId
			}, signal);
		}
		if (snapshot.state !== "ACKNOWLEDGED" || snapshot.purpose !== "work-input" || snapshot.workId !== input.workId || snapshot.basisSha256 !== basis.sha256 || !snapshot.manifest) deny("CANDIDATE_SNAPSHOT_UNAVAILABLE");
		const fence = await this.options.fencer.acquire({
			kind: "project",
			directoryRoot: this.controlDataRoot,
			resourceId: basis.repository.resourceId,
			operationId: snapshot.operationId
		}, signal);
		try {
			const provider = await this.project(basis);
			for (const ref of snapshot.updates) if (ref.ref.startsWith("refs/devmesh/candidates/") || await provider.readRef(ref.ref, signal) !== snapshot.manifest.commit) deny("CANDIDATE_SNAPSHOT_REF_CHANGED");
			const manifest = await provider.manifest(snapshot.manifest.commit, signal);
			if (canonical({
				commit: manifest.commit,
				tree: manifest.tree,
				sha256: manifest.sha256
			}) !== canonical(snapshot.manifest)) deny("CANDIDATE_MANIFEST_CHANGED");
			await this.options.storage.request("assertCandidateSourceBasis", {
				...subject,
				basisSha256: basis.sha256
			});
			const current = await this.options.storage.request("getQualifiedCandidateSnapshot", subject);
			if (current.operationId !== snapshot.operationId || canonical(current.manifest) !== canonical(snapshot.manifest)) deny("CANDIDATE_SNAPSHOT_CHANGED");
		} finally {
			await fence.release();
		}
	}
	async reconcile(input, signal = new AbortController().signal) {
		const record = await this.options.storage.request("getCandidateIntegration", input);
		return this.integrate({
			principalId: input.principalId,
			operationId: input.operationId,
			runId: record.runId,
			purpose: record.purpose,
			...record.workId ? { workId: record.workId } : {},
			...record.originOperationId ? { originOperationId: record.originOperationId } : {}
		}, signal);
	}
};
//#endregion
//#region src/candidate-conflicts.ts
const hash$4 = (value) => createHash("sha256").update(value).digest("hex");
function fail$5(code) {
	throw new WorkspaceError(code, "unknown");
}
const key = (c) => ({
	principalId: c.record.principalId,
	operationId: c.record.operationId,
	ordinal: c.step.ordinal
});
const bound = (c) => ({
	...key(c),
	requestHash: c.record.requestHash
});
function blob(bytes, objectId) {
	if (bytes.byteLength > 2 * 1024 * 1024 || createHash("sha1").update("blob " + bytes.byteLength + "\0").update(bytes).digest("hex") !== objectId) fail$5("CANDIDATE_CONFLICT_BLOB_CHANGED");
	return Buffer.from(bytes);
}
/** Content publication retains the raw report and virtual stage-1 bytes before
* preparing the step. No recovery path invokes merge-tree again. */
var LocalCandidateConflicts = class {
	storage;
	content;
	constructor(storage, content) {
		this.storage = storage;
		this.content = content;
	}
	async put(c, row, bytes) {
		const d = row.descriptor;
		if (d.kind !== "FILE" && d.kind !== "REPORT") return;
		if (!row.writeKey) fail$5("CANDIDATE_MATERIAL_WRITE_UNKNOWN");
		const source = bytes ?? { [Symbol.asyncIterator]() {
			return { async next() {
				throw new WorkspaceError("CANDIDATE_REPORT_BYTES_UNKNOWN", "unknown");
			} };
		} };
		await this.content.put({
			meta: {
				principalId: c.record.principalId,
				scopeId: c.record.operationId,
				idempotencyKey: row.writeKey
			},
			target: {
				kind: "candidateMaterial",
				operationId: c.record.operationId,
				ordinal: c.step.ordinal,
				materialKey: row.materialKey
			},
			expectedHash: d.sha256,
			expectedSize: d.byteSize,
			mimeType: d.kind === "REPORT" ? "application/json" : "application/octet-stream"
		}, source);
		await this.content.provider.verify(d.sha256, d.byteSize);
	}
	async capture(c, merge) {
		const virtualBaseBlobs = [];
		let total = 0;
		for (const objectId of [...new Set(merge.stages.filter((stage) => stage.stage === 1).map((stage) => stage.objectId))].sort()) {
			const bytes = blob(await c.repository.readBlob(objectId, c.signal), objectId);
			total += bytes.length;
			if (total > 16 * 1024 * 1024) fail$5("CANDIDATE_REPORT_TOO_LARGE");
			virtualBaseBlobs.push({
				objectId,
				base64: bytes.toString("base64")
			});
		}
		const envelope = {
			schemaVersion: "devmesh.candidate-report.v1",
			merge,
			virtualBaseBlobs
		}, bytes = Buffer.from(canonical(envelope));
		candidateReportEnvelope.parse(envelope);
		if (bytes.length > 32 * 1024 * 1024) fail$5("CANDIDATE_REPORT_TOO_LARGE");
		const [row] = await this.storage.request("declareCandidateMaterials", {
			...bound(c),
			materials: [{
				kind: "REPORT",
				mergeSha256: hash$4(canonical(merge)),
				sha256: hash$4(bytes),
				byteSize: bytes.length
			}]
		});
		await this.put(c, row, bytes);
	}
	async saved(c) {
		const row = await this.storage.request("getCandidateMaterial", {
			...key(c),
			materialKey: "report"
		});
		if (!row) return null;
		if (row.descriptor.kind !== "REPORT") fail$5("CANDIDATE_REPORT_CHANGED");
		await this.put(c, row);
		const text = await this.content.readText(c.record.principalId, {
			kind: "candidateMaterial",
			operationId: c.record.operationId,
			ordinal: c.step.ordinal,
			materialKey: "report"
		}, 32 * 1024 * 1024), envelope = candidateReportEnvelope.parse(JSON.parse(text)), merge = envelope.merge;
		if (canonical(envelope) !== text || hash$4(text) !== row.descriptor.sha256 || hash$4(canonical(merge)) !== row.descriptor.mergeSha256 || merge.ours !== c.step.ours || merge.theirs !== c.step.theirs || merge.base !== (merge.bases.length === 1 ? merge.bases[0] : null) || new Set(merge.bases).size !== merge.bases.length || c.step.preparation && (c.step.preparation.reportSha256 !== row.descriptor.mergeSha256 || c.step.preparation.tree !== merge.tree || c.step.preparation.clean !== merge.clean)) fail$5("CANDIDATE_REPORT_CHANGED");
		const expected = new Set(merge.stages.filter((stage) => stage.stage === 1).map((stage) => stage.objectId)), virtual = /* @__PURE__ */ new Map();
		let size = 0;
		for (const item of envelope.virtualBaseBlobs) {
			const bytes = blob(Buffer.from(item.base64, "base64"), item.objectId);
			if (bytes.toString("base64") !== item.base64 || !expected.delete(item.objectId) || virtual.has(item.objectId)) fail$5("CANDIDATE_VIRTUAL_BASE_CHANGED");
			size += bytes.length;
			if (size > 16 * 1024 * 1024) fail$5("CANDIDATE_REPORT_TOO_LARGE");
			virtual.set(item.objectId, bytes);
		}
		if (expected.size) fail$5("CANDIDATE_VIRTUAL_BASE_MISSING");
		return {
			merge,
			virtual
		};
	}
	async recoverReport(c) {
		return (await this.saved(c))?.merge ?? null;
	}
	async publish(c, merge) {
		const saved = await this.saved(c);
		if (!saved || canonical(saved.merge) !== canonical(merge) || merge.clean || c.step.state !== "CONFLICT_PENDING") fail$5("CANDIDATE_CONFLICT_UNPROVEN");
		const paths = [.../* @__PURE__ */ new Set([...merge.stages.map((stage) => stage.path), ...merge.messages.flatMap((message) => message.paths)])].sort();
		if (!paths.length || paths.length > 4e3) fail$5("CANDIDATE_CONFLICT_PATHS_INVALID");
		const versions = [
			...merge.bases.map((commit) => ({
				version: "base." + commit,
				commit
			})),
			{
				version: "ours",
				commit: merge.ours
			},
			{
				version: "theirs",
				commit: merge.theirs
			}
		], descriptors = [];
		const bytesByObject = new Map(saved.virtual);
		const file = async (path, version, objectId, mode) => {
			let bytes = bytesByObject.get(objectId);
			if (!bytes) {
				bytes = blob(await c.repository.readBlob(objectId, c.signal), objectId);
				bytesByObject.set(objectId, bytes);
			}
			descriptors.push({
				kind: "FILE",
				path,
				version,
				objectId,
				mode,
				sha256: hash$4(bytes),
				byteSize: bytes.length
			});
		};
		for (const { version, commit } of versions) {
			const entries = new Map((await c.repository.treeEntries(commit, c.signal)).map((entry) => [entry.path, entry]));
			for (const path of paths) {
				const entry = entries.get(path);
				if (!entry) descriptors.push({
					kind: "ABSENT",
					path,
					version
				});
				else if (entry.kind === "DIRECTORY") descriptors.push({
					kind: "DIRECTORY",
					path,
					version,
					objectId: entry.objectId
				});
				else await file(path, version, entry.objectId, entry.mode);
			}
		}
		for (const path of paths) for (const stage of [
			1,
			2,
			3
		]) {
			const entry = merge.stages.find((item) => item.path === path && item.stage === stage), version = "stage." + stage;
			if (entry) await file(path, version, entry.objectId, entry.mode);
			else descriptors.push({
				kind: "ABSENT",
				path,
				version
			});
		}
		if (descriptors.length + 1 > 2e4) fail$5("CANDIDATE_MATERIALS_TOO_LARGE");
		for (let start = 0; start < descriptors.length; start += 100) {
			c.signal.throwIfAborted();
			const rows = await this.storage.request("declareCandidateMaterials", {
				...bound(c),
				materials: descriptors.slice(start, start + 100)
			});
			for (const row of rows) {
				const d = row.descriptor;
				if (d.kind === "FILE") await this.put(c, row, bytesByObject.get(d.objectId) ?? fail$5("CANDIDATE_CONFLICT_BLOB_MISSING"));
			}
		}
		const rows = [];
		let afterKey = "";
		while (true) {
			const page = await this.storage.request("listCandidateMaterials", {
				...key(c),
				afterKey,
				limit: 100
			});
			if (!page.length) break;
			rows.push(...page);
			afterKey = page.at(-1).materialKey;
		}
		const manifestSha256 = hash$4(canonical({
			schemaVersion: "devmesh.candidate-materials.v1",
			operationId: c.record.operationId,
			ordinal: c.step.ordinal,
			materials: rows.map((row) => ({
				materialKey: row.materialKey,
				descriptor: row.descriptor
			}))
		}));
		const expectedKeys = /* @__PURE__ */ new Set(["report", ...descriptors.map(candidateMaterialKey)]);
		if (rows.length !== expectedKeys.size || rows.some((row) => !expectedKeys.has(row.materialKey))) fail$5("CANDIDATE_CONFLICT_MANIFEST_CHANGED");
		await this.storage.request("sealCandidateConflictMaterials", {
			...bound(c),
			materialCount: rows.length,
			manifestSha256
		});
		await c.repository.validate(c.signal);
		const proof = {
			repositoryIdentity: c.basis.repository.identity,
			reportSha256: hash$4(canonical(merge)),
			manifestSha256,
			materialCount: rows.length
		};
		try {
			await this.storage.request("acknowledgeCandidateConflict", {
				...bound(c),
				proof
			});
		} catch (error) {
			const record = await this.storage.request("getCandidateIntegration", {
				principalId: c.record.principalId,
				operationId: c.record.operationId
			}).catch(() => null);
			if (record?.state !== "CONFLICT" || canonical(record.conflictAcknowledgement) !== canonical(proof)) throw error;
		}
		return this.storage.request("getCandidateIntegration", {
			principalId: c.record.principalId,
			operationId: c.record.operationId
		});
	}
	async reconcile(c) {
		const saved = await this.saved(c);
		if (!saved) fail$5("CANDIDATE_REPORT_BYTES_UNKNOWN");
		return this.publish(c, saved.merge);
	}
};
//#endregion
//#region src/workspace-materials.ts
const hash$3 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const integer = /^\d+$/;
function fail$4(code) {
	throw new WorkspaceError(code, "unknown");
}
function id(stat) {
	return {
		device: String(stat.dev),
		fileId: String(stat.ino)
	};
}
function same(a, b) {
	return a.dev === b.dev && a.ino === b.ino && a.mode === b.mode && a.nlink === b.nlink && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}
function safe(path) {
	if (!path || path.length > 1024 || path.split("/").some((part) => !part || part === "." || part === ".." || [...part].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) || /[<>:"\\|?*]/.test(part) || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) fail$4("WORKSPACE_MATERIAL_PATH_DENIED");
}
function secret(path) {
	return path.split("/").some((part) => /^\.env(?:\.|$)/i.test(part) && !/^\.env\.(example|sample|template)$/i.test(part) || /^(id_rsa|id_ed25519|credentials(?:\.json)?|\.npmrc|\.netrc)$/i.test(part) || /\.(pem|p12|pfx|key)$/i.test(part));
}
function inside(root, path) {
	const r = relative(root, path);
	return r === "" || r !== ".." && !r.startsWith(".." + sep) && !isAbsolute(r);
}
/** Read-only capture. The caller must hold the original workspace's actual
* Runner/editor fence. This scan alone is never an archive or deletion ACK.
* All regular files are captured, including Git-ignored and recovery bytes.
* The only exclusions are owned Git storage and rebuildable node_modules. */
async function captureWorkspaceMaterials(input, signal) {
	if (!isAbsolute(input.root) || await realpath(input.root) !== input.root) fail$4("WORKSPACE_MATERIAL_ROOT_CHANGED");
	const rootBefore = await lstat(input.root, { bigint: true });
	if (!rootBefore.isDirectory() || rootBefore.isSymbolicLink()) fail$4("WORKSPACE_MATERIAL_ROOT_CHANGED");
	const entries = [], bytes = /* @__PURE__ */ new Map(), seen = /* @__PURE__ */ new Set(), groups = /* @__PURE__ */ new Map(), directories = /* @__PURE__ */ new Map();
	let byteSize = 0;
	function add(entry) {
		safe(entry.path);
		const folded = entry.path.toLowerCase();
		if (seen.has(folded)) fail$4("WORKSPACE_MATERIAL_PATH_COLLISION");
		seen.add(folded);
		entries.push(entry);
		if (entries.length > 8e3) fail$4("WORKSPACE_MATERIALS_TOO_LARGE");
	}
	async function walk(directory, prefix) {
		signal.throwIfAborted();
		const before = await lstat(directory, { bigint: true });
		if (!before.isDirectory() || before.isSymbolicLink() || !inside(input.root, await realpath(directory))) fail$4("WORKSPACE_MATERIAL_ROOT_CHANGED");
		directories.set(directory, before);
		const names = (await readdir(directory)).sort();
		for (const name of names) {
			signal.throwIfAborted();
			const path = prefix ? prefix + "/" + name : name;
			safe(path);
			const absolute = join(directory, name), stat = await lstat(absolute, { bigint: true });
			if (stat.isSymbolicLink()) fail$4("WORKSPACE_MATERIAL_LINK_DENIED");
			if (path === "repo/.git") {
				if (!stat.isDirectory() || await realpath(absolute) !== absolute) fail$4("WORKSPACE_MATERIAL_GIT_CHANGED");
				add({
					kind: "EXCLUDED",
					path,
					reason: "retained-git-repository",
					identity: id(stat)
				});
				continue;
			}
			if (path.startsWith("repo/") && name === "node_modules" && stat.isDirectory()) {
				if (await realpath(absolute) !== absolute) fail$4("WORKSPACE_MATERIAL_LINK_DENIED");
				add({
					kind: "EXCLUDED",
					path,
					reason: "rebuildable-node-modules",
					identity: id(stat)
				});
				continue;
			}
			if (secret(path)) fail$4("WORKSPACE_MATERIAL_SECRET_PATH");
			if (stat.isDirectory()) {
				add({
					kind: "DIRECTORY",
					path,
					identity: id(stat),
					mode: Number(stat.mode & 511n)
				});
				await walk(absolute, path);
				continue;
			}
			if (!stat.isFile() || (stat.mode & 3584n) !== 0n || stat.size > 2n * 1024n * 1024n || stat.nlink < 1n || stat.nlink > 8000n) fail$4("WORKSPACE_MATERIAL_FILE_DENIED");
			byteSize += Number(stat.size);
			if (byteSize > 128 * 1024 * 1024) fail$4("WORKSPACE_MATERIALS_TOO_LARGE");
			const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
			let value;
			try {
				if (!same(await handle.stat({ bigint: true }), stat)) fail$4("WORKSPACE_MATERIAL_CHANGED");
				value = await handle.readFile();
				if (value.length !== Number(stat.size) || !same(await handle.stat({ bigint: true }), stat)) fail$4("WORKSPACE_MATERIAL_CHANGED");
			} finally {
				await handle.close();
			}
			if (!same(await lstat(absolute, { bigint: true }), stat)) fail$4("WORKSPACE_MATERIAL_CHANGED");
			const key = String(stat.dev) + ":" + String(stat.ino), group = groups.get(key) ?? {
				links: Number(stat.nlink),
				paths: []
			};
			if (group.links !== Number(stat.nlink)) fail$4("WORKSPACE_MATERIAL_LINK_DENIED");
			group.paths.push(path);
			groups.set(key, group);
			add({
				kind: "FILE",
				path,
				identity: id(stat),
				mode: Number(stat.mode & 511n),
				links: Number(stat.nlink),
				mtimeNs: String(stat.mtimeNs),
				ctimeNs: String(stat.ctimeNs),
				byteSize: value.length,
				sha256: hash$3(value)
			});
			bytes.set(path, value);
		}
		if (!same(await lstat(directory, { bigint: true }), before) || canonical((await readdir(directory)).sort()) !== canonical(names)) fail$4("WORKSPACE_MATERIAL_CHANGED");
	}
	await walk(input.root, "");
	for (const group of groups.values()) if (group.paths.length !== group.links) fail$4("WORKSPACE_MATERIAL_EXTERNAL_HARDLINK");
	const excluded = entries.filter((e) => e.kind === "EXCLUDED").map((e) => e.path), byPath = new Map(entries.map((entry) => [entry.path, entry]));
	if (new Set(input.baseFiles.map((path) => path.toLowerCase())).size !== input.baseFiles.length) fail$4("WORKSPACE_MATERIAL_PATH_COLLISION");
	for (const base of input.baseFiles) {
		safe(base);
		const path = "repo/" + base;
		if (excluded.some((parent) => path === parent || path.startsWith(parent + "/"))) fail$4("WORKSPACE_MATERIAL_TRACKED_EXCLUSION");
		if (!byPath.has(path)) {
			const parts = path.split("/");
			let absent = false;
			for (let i = 1; i <= parts.length; i++) {
				const prefix = parts.slice(0, i).join("/"), entry = byPath.get(prefix);
				if (!entry || i < parts.length && entry.kind !== "DIRECTORY") {
					absent = true;
					break;
				}
			}
			if (!absent) fail$4("WORKSPACE_MATERIAL_CHANGED");
			add({
				kind: "ABSENT",
				path
			});
		}
	}
	for (const [directory, before] of directories) if (!same(await lstat(directory, { bigint: true }), before)) fail$4("WORKSPACE_MATERIAL_CHANGED");
	if (!same(await lstat(input.root, { bigint: true }), rootBefore) || await realpath(input.root) !== input.root) fail$4("WORKSPACE_MATERIAL_ROOT_CHANGED");
	entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
	const facts = {
		schemaVersion: "devmesh.workspace-materials.v1",
		root: input.root,
		identity: id(rootBefore),
		entries,
		byteSize
	};
	if (Buffer.byteLength(canonical(facts)) > 8 * 1024 * 1024) fail$4("WORKSPACE_MATERIALS_TOO_LARGE");
	return {
		snapshot: {
			...facts,
			sha256: hash$3(canonical(facts))
		},
		bytes
	};
}
/** Verifies the complete original snapshot, including identities, missing
* markers, recovery files, ignored files and new additions under the fence. */
async function verifyWorkspaceMaterials(snapshot, baseFiles, signal) {
	if (!integer.test(snapshot.identity.device) || !integer.test(snapshot.identity.fileId)) fail$4("WORKSPACE_MATERIAL_ROOT_CHANGED");
	const current = await captureWorkspaceMaterials({
		root: snapshot.root,
		baseFiles
	}, signal);
	if (canonical(current.snapshot) !== canonical(snapshot)) fail$4("WORKSPACE_MATERIAL_CHANGED");
	return current;
}
//#endregion
//#region src/workspace-preservations.ts
const hash$2 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fail$3(code) {
	throw new WorkspaceError(code, "unknown");
}
async function exists(path) {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}
async function identity(provider) {
	await provider.validate();
	const { root, gitDirectory, commonDirectory } = provider.identity, [r, g] = await Promise.all([lstat(root, { bigint: true }), lstat(gitDirectory, { bigint: true })]);
	return {
		root,
		gitDirectory,
		commonDirectory,
		rootDevice: String(r.dev),
		rootFileId: String(r.ino),
		gitDevice: String(g.dev),
		gitFileId: String(g.ino)
	};
}
async function syncDirectory(path) {
	if (process.platform === "win32") return;
	const file = await open(path, "r");
	try {
		await file.sync();
	} finally {
		await file.close();
	}
}
function baseFiles$1(b) {
	return [...new Set([b.allocation.manifest, ...b.commits.map((c) => c.archive.manifest)].flatMap((m) => m.files.map((f) => f.path)))].sort();
}
/** Full original-material preservation. A durable control ACK and a separately
* fsynced Runner-local receipt are required before the reclamation boundary.
* This service never deletes a workspace or infers a stopped job from expiry. */
var LocalWorkspacePreservations = class {
	options;
	controlDataRoot;
	runnerDataRoot;
	constructor(options) {
		this.options = options;
		if (options.mode !== "local-development" || !options.fencer || typeof options.fencer.acquire !== "function" || !options.sourceArchives) fail$3("WORKSPACE_PRESERVATION_BACKEND_NOT_CONFIGURED");
		this.controlDataRoot = canonicalRoot(options.controlDataRoot);
		this.runnerDataRoot = canonicalRoot(options.runnerDataRoot);
		assertSeparate([
			this.controlDataRoot,
			this.runnerDataRoot,
			canonicalRoot(options.backupRoot)
		]);
		if (options.content.storage !== options.storage || canonicalRoot(options.content.dataRoot) !== this.controlDataRoot || options.sourceArchives.options.storage !== options.storage || options.sourceArchives.controlDataRoot !== this.controlDataRoot || options.sourceArchives.runnerDataRoot !== this.runnerDataRoot || options.sourceArchives.options.fencer !== options.fencer) fail$3("WORKSPACE_PRESERVATION_STORAGE_CHANGED");
	}
	async acquire(record, permit, signal) {
		let project, workspace;
		try {
			project = await this.options.fencer.acquire({
				kind: "project",
				directoryRoot: this.controlDataRoot,
				resourceId: record.basis.repository.resourceId,
				operationId: record.operationId
			}, signal);
			workspace = await this.options.fencer.acquire({
				kind: "workspace",
				directoryRoot: this.runnerDataRoot,
				resourceId: record.workspaceRef,
				operationId: record.operationId,
				permit,
				purpose: "cleanup"
			}, signal);
			let released = false;
			return { release: async () => {
				if (released) return;
				await workspace.release();
				await project.release();
				released = true;
			} };
		} catch (error) {
			if (project) await project.release();
			throw error;
		}
	}
	async directories(record, signal) {
		const b = record.basis, a = b.allocation, projectRoot = join(await realpath(this.controlDataRoot), "repositories", a.projectId, "repo.git"), parent = join(await realpath(this.runnerDataRoot), "workspaces", a.attemptId), workspaceRoot = join(parent, "repo");
		if (b.repository.identity?.root !== projectRoot || a.identity?.root !== workspaceRoot || await realpath(parent) !== parent) fail$3("WORKSPACE_PRESERVATION_DIRECTORY_CHANGED");
		canonicalRoot(parent);
		const before = await lstat(parent, { bigint: true }), markerPath = join(parent, "code-directory.json"), markerStat = await lstat(markerPath), expected = canonical({
			schemaVersion: "devmesh.code-directory.v1",
			section: "workspaces",
			id: a.attemptId,
			operationId: a.operationId,
			requestHash: a.requestHash,
			device: String(before.dev),
			fileId: String(before.ino)
		});
		if (!before.isDirectory() || before.isSymbolicLink() || !markerStat.isFile() || markerStat.isSymbolicLink() || markerStat.nlink !== 1 || markerStat.size > 16384 || await readFile(markerPath, "utf8") !== expected) fail$3("WORKSPACE_PRESERVATION_DIRECTORY_UNOWNED");
		const project = await ControlledGit.open(projectRoot, "bare"), workspace = await ControlledGit.open(workspaceRoot, "checkout");
		if (canonical(await identity(project)) !== canonical(b.repository.identity) || canonical(await identity(workspace)) !== canonical(a.identity) || await workspace.head(signal) !== a.baseCommit) fail$3("WORKSPACE_PRESERVATION_DIRECTORY_CHANGED");
		await workspace.verifyAttemptBranch(a.baseCommit, a.attemptId, signal);
		if (await workspace.readRef("refs/devmesh/allocations/" + a.operationId, signal) !== a.baseCommit) fail$3("WORKSPACE_PRESERVATION_BASE_CHANGED");
		await workspace.verifyPreservationBasis(a.baseCommit, [
			{
				ref: "refs/devmesh/allocations/" + a.operationId,
				commit: a.baseCommit
			},
			{
				ref: "refs/heads/devmesh/" + a.attemptId,
				commit: a.baseCommit
			},
			...b.commits.map((c) => ({
				ref: c.ref,
				commit: c.commit
			}))
		], signal);
		return {
			parent,
			project,
			workspace,
			parentMarkerSha256: hash$2(expected)
		};
	}
	async retained(record, project, signal) {
		const m = record.manifest;
		if (!m) fail$3("WORKSPACE_PRESERVATION_UNPREPARED");
		for (const r of m.retained) if (await project.readRef(r.ref, signal) !== r.commit || canonical(await project.manifest(r.commit, signal)) !== canonical(r.manifest)) fail$3("WORKSPACE_PRESERVATION_RETENTION_UNKNOWN");
		for (const c of record.basis.commits) {
			const a = c.archive.acknowledgement;
			if (await project.readRef(a.sourceRef, signal) !== c.commit || a.commit !== c.commit || a.tree !== c.tree || a.manifestSha256 !== c.archive.manifest.sha256 || canonical(a.repositoryIdentity) !== canonical(record.basis.repository.identity)) fail$3("WORKSPACE_PRESERVATION_RETENTION_UNKNOWN");
		}
	}
	receiptPath(record) {
		return join(this.runnerDataRoot, "registry", "workspace-preservations", record.workspaceRef, record.operationId, "receipt.json");
	}
	receiptBytes(record) {
		if (record.state !== "ACKNOWLEDGED" || !record.acknowledgement) fail$3("WORKSPACE_PRESERVATION_ACK_REQUIRED");
		return canonical({
			schemaVersion: "devmesh.workspace-preservation-receipt.v1",
			operationId: record.operationId,
			allocationOperationId: record.allocationOperationId,
			workspaceRef: record.workspaceRef,
			requestHash: record.requestHash,
			acknowledgement: record.acknowledgement
		});
	}
	async receipt(record, create) {
		const path = this.receiptPath(record), expected = this.receiptBytes(record), directory = dirname(path);
		if (create) {
			canonicalRoot(this.runnerDataRoot);
			await mkdir(directory, {
				recursive: true,
				mode: 448
			});
			canonicalRoot(directory);
			if (!await exists(path)) {
				const output = await open(path, "wx", 384);
				try {
					await output.writeFile(expected);
					await output.sync();
				} finally {
					await output.close();
				}
				await syncDirectory(directory);
			}
		}
		canonicalRoot(directory);
		const stat = await lstat(path);
		if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32768 || await readFile(path, "utf8") !== expected) fail$3("WORKSPACE_PRESERVATION_RECEIPT_CHANGED");
	}
	async publish(record, permit, bytes) {
		const m = record.manifest;
		let afterKey = "";
		while (true) {
			const rows = await this.options.storage.request("listWorkspacePreservationMaterials", {
				permit,
				operationId: record.operationId,
				afterKey,
				limit: 100
			});
			if (!rows.length) break;
			for (const row of rows) {
				const path = m.snapshot.entries.find((e) => e.kind === "FILE" && workspacePreservationMaterialKey(e.path) === row.materialKey)?.path, value = row.materialKey === "manifest" ? Buffer.from(canonical(m)) : path ? bytes.get(path) : void 0;
				if (!value || hash$2(value) !== row.sha256 || value.length !== row.byteSize) fail$3("WORKSPACE_PRESERVATION_MATERIAL_CHANGED");
				await this.options.content.put({
					meta: {
						principalId: record.principalId,
						scopeId: record.operationId,
						idempotencyKey: row.writeKey
					},
					target: {
						kind: "workspacePreservation",
						operationId: record.operationId,
						materialKey: row.materialKey
					},
					expectedHash: row.sha256,
					expectedSize: row.byteSize,
					mimeType: row.materialKey === "manifest" ? "application/json" : "application/octet-stream"
				}, value);
				await this.options.content.provider.verify(row.sha256, row.byteSize);
			}
			afterKey = rows.at(-1).materialKey;
		}
	}
	async verifyContent(record, permit) {
		let afterKey = "", count = 0;
		while (true) {
			const rows = await this.options.storage.request("listWorkspacePreservationMaterials", {
				permit,
				operationId: record.operationId,
				afterKey,
				limit: 100
			});
			if (!rows.length) break;
			for (const row of rows) {
				if (row.contentHash !== row.sha256 || !row.writeId) fail$3("WORKSPACE_PRESERVATION_MATERIAL_UNAVAILABLE");
				await this.options.content.provider.verify(row.sha256, row.byteSize);
				count++;
			}
			afterKey = rows.at(-1).materialKey;
		}
		return count;
	}
	settledRecovery(record) {
		const prefix = ".devmesh-file-operations/", group = hash$2(record.workspaceRef), operations = new Map(record.basis.fileOperations.map((op) => [op.operationId, op]));
		for (const entry of record.manifest.snapshot.entries) {
			if (!entry.path.startsWith(prefix)) continue;
			const parts = entry.path.slice(25).split("/");
			if (parts[0] !== group || parts.length > 3) fail$3("WORKSPACE_PRESERVATION_RECOVERY_UNKNOWN");
			if (parts.length === 1) {
				if (entry.kind !== "DIRECTORY") fail$3("WORKSPACE_PRESERVATION_RECOVERY_UNKNOWN");
				continue;
			}
			const op = operations.get(parts[1]);
			if (!op || !op.cleanupConfirmed || !["SUCCEEDED", "FAILED"].includes(op.state)) fail$3("WORKSPACE_PRESERVATION_RECOVERY_UNKNOWN");
			if (parts.length === 2) {
				if (entry.kind !== "DIRECTORY") fail$3("WORKSPACE_PRESERVATION_RECOVERY_UNKNOWN");
				continue;
			}
			if (entry.kind !== "FILE" || ![
				"stage",
				"previous",
				"receipt",
				"deleted"
			].includes(parts[2]) || op.state === "SUCCEEDED" && ["stage", "receipt"].includes(parts[2])) fail$3("WORKSPACE_PRESERVATION_RECOVERY_UNKNOWN");
		}
	}
	async archive(input, signal = new AbortController().signal) {
		let original;
		try {
			original = await this.options.storage.request("getWorkspacePreservation", {
				permit: input.permit,
				operationId: input.operationId
			});
		} catch (error) {
			if (error.code !== "WORKSPACE_PRESERVATION_NOT_FOUND") throw error;
			original = null;
		}
		if (!original) {
			const inputs = await this.options.storage.request("getWorkspacePreservationInputs", {
				permit: input.permit,
				allocationOperationId: input.allocationOperationId
			});
			for (const c of inputs.commits) if (!c.archive) {
				const operationId = "op_" + hash$2("workspace-preservation-source\0" + input.allocationOperationId + "\0" + c.operationId);
				await this.options.sourceArchives.archive({
					permit: input.permit,
					operationId,
					allocationOperationId: input.allocationOperationId,
					commitOperationId: c.operationId
				}, signal);
			}
		}
		const { created: _created, ...pending } = await this.options.storage.request("beginWorkspacePreservation", input);
		let record = pending;
		if (record.state === "ACKNOWLEDGED") {
			await this.receipt(record, true);
			return record;
		}
		const fence = await this.acquire(record, input.permit, signal);
		try {
			const physical = await this.directories(record, signal), files = baseFiles$1(record.basis), mayRetain = record.state === "SENT";
			let capture;
			if (record.manifest) capture = await verifyWorkspaceMaterials(record.manifest.snapshot, files, signal);
			else {
				capture = await captureWorkspaceMaterials({
					root: physical.parent,
					baseFiles: files
				}, signal);
				const manifest = {
					schemaVersion: "devmesh.workspace-preservation.v1",
					operationId: record.operationId,
					allocationOperationId: record.allocationOperationId,
					workspaceRef: record.workspaceRef,
					basisSha256: record.basisSha256,
					headCommit: record.basis.allocation.baseCommit,
					repositoryIdentity: record.basis.repository.identity,
					workspaceIdentity: record.basis.allocation.identity,
					parentMarkerSha256: physical.parentMarkerSha256,
					retained: [{
						ref: "refs/devmesh/workspace-preservations/" + record.operationId + "/base",
						commit: record.basis.allocation.baseCommit,
						manifest: record.basis.allocation.manifest
					}, ...record.basis.commits.map((c) => ({
						ref: c.archive.acknowledgement.archiveRef,
						commit: c.commit,
						manifest: c.archive.manifest
					}))],
					snapshot: capture.snapshot
				};
				record = await this.options.storage.request("prepareWorkspacePreservation", {
					permit: input.permit,
					operationId: record.operationId,
					requestHash: record.requestHash,
					manifest
				});
			}
			if (record.manifest.parentMarkerSha256 !== physical.parentMarkerSha256) fail$3("WORKSPACE_PRESERVATION_DIRECTORY_CHANGED");
			if (mayRetain) {
				const base = record.manifest.retained[0];
				if (await physical.project.readRef(base.ref, signal) !== null) fail$3("WORKSPACE_PRESERVATION_RETENTION_UNKNOWN");
				await physical.project.updateRefs([{
					ref: base.ref,
					commit: base.commit,
					expected: null
				}], signal);
			}
			await this.retained(record, physical.project, signal);
			await this.publish(record, input.permit, capture.bytes);
			await verifyWorkspaceMaterials(record.manifest.snapshot, files, signal);
			const acknowledgement = {
				manifestSha256: hash$2(canonical(record.manifest)),
				snapshotSha256: record.manifest.snapshot.sha256,
				materialCount: await this.verifyContent(record, input.permit),
				repositoryIdentity: await identity(physical.project),
				workspaceIdentity: await identity(physical.workspace),
				parentIdentity: record.manifest.snapshot.identity
			};
			try {
				record = await this.options.storage.request("completeWorkspacePreservation", {
					permit: input.permit,
					operationId: record.operationId,
					requestHash: record.requestHash,
					acknowledgement
				});
			} catch (error) {
				const observed = await this.options.storage.request("getWorkspacePreservation", {
					permit: input.permit,
					operationId: record.operationId
				}).catch(() => null);
				if (observed?.state !== "ACKNOWLEDGED" || canonical(observed.acknowledgement) !== canonical(acknowledgement)) throw error;
				record = observed;
			}
			await this.receipt(record, true);
			return record;
		} finally {
			await fence.release();
		}
	}
	async reconcile(input, signal = new AbortController().signal) {
		const original = await this.options.storage.request("getWorkspacePreservation", input);
		return this.archive({
			...input,
			allocationOperationId: original.allocationOperationId
		}, signal);
	}
	/** Read-only complete archive proof. A reclamation caller holds its own
	* original project/workspace cleanup barriers while using this result. */
	async verifyArchiveProof(input, signal = new AbortController().signal) {
		const record = await this.options.storage.request("assertWorkspacePreservationReclaimable", input), expected = join(await realpath(this.controlDataRoot), "repositories", record.basis.allocation.projectId, "repo.git");
		if (record.basis.repository.identity?.root !== expected) fail$3("WORKSPACE_PRESERVATION_DIRECTORY_CHANGED");
		const project = await ControlledGit.open(expected, "bare");
		if (canonical(await identity(project)) !== canonical(record.basis.repository.identity)) fail$3("WORKSPACE_PRESERVATION_DIRECTORY_CHANGED");
		await this.receipt(record, false);
		this.settledRecovery(record);
		await this.retained(record, project, signal);
		if (await this.verifyContent(record, input.permit) !== record.acknowledgement.materialCount) fail$3("WORKSPACE_PRESERVATION_ACK_UNPROVEN");
		await this.options.storage.request("assertWorkspacePreservationReclaimable", input);
		return record;
	}
	/** Read-only original checkout verification, called inside a cleanup barrier. */
	async verifyReclaimable(input, signal = new AbortController().signal) {
		const record = await this.options.storage.request("assertWorkspacePreservationReclaimable", input), physical = await this.directories(record, signal);
		await this.receipt(record, false);
		this.settledRecovery(record);
		if (physical.parentMarkerSha256 !== record.manifest.parentMarkerSha256) fail$3("WORKSPACE_PRESERVATION_DIRECTORY_CHANGED");
		await this.retained(record, physical.project, signal);
		await verifyWorkspaceMaterials(record.manifest.snapshot, baseFiles$1(record.basis), signal);
		if (await this.verifyContent(record, input.permit) !== record.acknowledgement.materialCount) fail$3("WORKSPACE_PRESERVATION_ACK_UNPROVEN");
		await this.options.storage.request("assertWorkspacePreservationReclaimable", input);
		return record;
	}
	/** Caller retains the actual Runner barrier until isolation is complete. */
	async acquireReclaimable(input, signal = new AbortController().signal) {
		const initial = await this.options.storage.request("assertWorkspacePreservationReclaimable", input), fence = await this.acquire(initial, input.permit, signal);
		try {
			const record = await this.verifyReclaimable(input, signal);
			return {
				record,
				parent: record.manifest.snapshot.root,
				release: fence.release
			};
		} catch (error) {
			await fence.release();
			throw error;
		}
	}
};
//#endregion
//#region src/workspace-remnants.ts
const hash$1 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fail$2(code) {
	throw new WorkspaceError(code, "unknown");
}
function stable(a, b) {
	return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mode === b.mode && a.nlink === b.nlink && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}
/** Read-only verification of leftovers after an already proven DELETE_SENT.
* Missing original entries are allowed; additions, replacements, changed bytes,
* new external links and an unproven root are rejected. The caller still needs
* the original archive ACK, isolation/delete receipts, current cleanup authority
* and the actual Runner barrier. This function never authorizes or performs rm. */
async function verifyWorkspaceRemnants(snapshot, root, signal) {
	const { sha256, ...facts } = snapshot;
	if (hash$1(canonical(facts)) !== sha256 || !isAbsolute(root) || await realpath(root) !== root) fail$2("WORKSPACE_RECLAMATION_ROOT_CHANGED");
	const top = await lstat(root, { bigint: true });
	if (!top.isDirectory() || top.isSymbolicLink() || String(top.dev) !== snapshot.identity.device || String(top.ino) !== snapshot.identity.fileId) fail$2("WORKSPACE_RECLAMATION_ROOT_CHANGED");
	const expected = new Map(snapshot.entries.map((entry) => [entry.path, entry])), groups = /* @__PURE__ */ new Map(), directories = /* @__PURE__ */ new Map();
	let count = 0, byteSize = 0;
	if (expected.size !== snapshot.entries.length) fail$2("WORKSPACE_RECLAMATION_MANIFEST_CHANGED");
	async function visit(directory, prefix) {
		signal.throwIfAborted();
		const before = await lstat(directory, { bigint: true });
		if (!before.isDirectory() || before.isSymbolicLink() || !prefix && !stable(before, top)) fail$2("WORKSPACE_RECLAMATION_ROOT_CHANGED");
		directories.set(directory, before);
		const names = (await readdir(directory)).sort();
		for (const name of names) {
			signal.throwIfAborted();
			const path = prefix ? prefix + "/" + name : name, e = expected.get(path);
			if (!e || e.kind === "ABSENT") fail$2("WORKSPACE_RECLAMATION_MATERIAL_UNKNOWN");
			const absolute = join(directory, name), stat = await lstat(absolute, { bigint: true });
			if (stat.isSymbolicLink() || String(stat.dev) !== e.identity.device || String(stat.ino) !== e.identity.fileId) fail$2("WORKSPACE_RECLAMATION_MATERIAL_CHANGED");
			count++;
			if (e.kind === "EXCLUDED") {
				if (!stat.isDirectory() || await realpath(absolute) !== absolute) fail$2("WORKSPACE_RECLAMATION_MATERIAL_CHANGED");
				continue;
			}
			if (e.kind === "DIRECTORY") {
				if (!stat.isDirectory() || (stat.mode & 3584n) !== 0n || Number(stat.mode & 511n) !== e.mode) fail$2("WORKSPACE_RECLAMATION_MATERIAL_CHANGED");
				await visit(absolute, path);
				continue;
			}
			if (!stat.isFile() || (stat.mode & 3584n) !== 0n || Number(stat.mode & 511n) !== e.mode || Number(stat.size) !== e.byteSize || String(stat.mtimeNs) !== e.mtimeNs || stat.nlink < 1n || stat.nlink > BigInt(e.links)) fail$2("WORKSPACE_RECLAMATION_MATERIAL_CHANGED");
			const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
			try {
				const first = await handle.stat({ bigint: true });
				if (!stable(first, stat)) fail$2("WORKSPACE_RECLAMATION_MATERIAL_CHANGED");
				const bytes = await handle.readFile();
				if (bytes.length !== e.byteSize || hash$1(bytes) !== e.sha256 || !stable(await handle.stat({ bigint: true }), first)) fail$2("WORKSPACE_RECLAMATION_MATERIAL_CHANGED");
			} finally {
				await handle.close();
			}
			if (!stable(await lstat(absolute, { bigint: true }), stat)) fail$2("WORKSPACE_RECLAMATION_MATERIAL_CHANGED");
			const key = String(stat.dev) + ":" + String(stat.ino), group = groups.get(key) ?? {
				links: Number(stat.nlink),
				count: 0
			};
			if (group.links !== Number(stat.nlink)) fail$2("WORKSPACE_RECLAMATION_MATERIAL_CHANGED");
			group.count++;
			groups.set(key, group);
			byteSize += Number(stat.size);
		}
		if (!stable(await lstat(directory, { bigint: true }), before) || canonical((await readdir(directory)).sort()) !== canonical(names)) fail$2("WORKSPACE_RECLAMATION_MATERIAL_CHANGED");
	}
	await visit(root, "");
	for (const group of groups.values()) if (group.count !== group.links) fail$2("WORKSPACE_RECLAMATION_EXTERNAL_HARDLINK");
	for (const [path, before] of directories) if (!stable(await lstat(path, { bigint: true }), before)) fail$2("WORKSPACE_RECLAMATION_MATERIAL_CHANGED");
	if (count > snapshot.entries.length || byteSize > snapshot.byteSize) fail$2("WORKSPACE_RECLAMATION_MANIFEST_CHANGED");
	return {
		remainingEntries: count,
		remainingBytes: byteSize
	};
}
//#endregion
//#region src/workspace-reclamations.ts
const hash = (value) => createHash("sha256").update(value).digest("hex");
function fail$1(code) {
	throw new WorkspaceError(code, "unknown");
}
async function stat(path) {
	try {
		return await lstat(path, { bigint: true });
	} catch (error) {
		if (error.code === "ENOENT") return null;
		throw error;
	}
}
async function sync(path) {
	if (process.platform === "win32") return;
	const file = await open(path, "r");
	try {
		await file.sync();
	} finally {
		await file.close();
	}
}
const baseFiles = (p) => [...new Set([p.basis.allocation.manifest, ...p.basis.commits.map((c) => c.archive.manifest)].flatMap((m) => m.files.map((f) => f.path)))].sort();
/** Exact-original local reclamation. The caller configures a trusted Runner
* cleanup fencer; no backend is enabled by default. */
var LocalWorkspaceReclamations = class {
	preservations;
	retentionMs;
	constructor(preservations, options = {}) {
		this.preservations = preservations;
		this.retentionMs = options.retentionMs ?? 1440 * 60 * 1e3;
		if (!Number.isSafeInteger(this.retentionMs) || this.retentionMs < 0 || this.retentionMs > 720 * 60 * 60 * 1e3) fail$1("WORKSPACE_RECLAMATION_RETENTION_INVALID");
	}
	get storage() {
		return this.preservations.options.storage;
	}
	async paths(record) {
		const runner = await realpath(this.preservations.runnerDataRoot), attempt = record.basis.preservation.basis.allocation.attemptId, source = join(runner, "workspaces", attempt), trash = join(runner, "trash", record.operationId);
		if (record.basis.sourcePath !== source || record.basis.trashPath !== trash || resolve(source) !== source || resolve(trash) !== trash || !source.startsWith(join(runner, "workspaces") + sep) || !trash.startsWith(join(runner, "trash") + sep) || source === trash) fail$1("WORKSPACE_RECLAMATION_PATH_CHANGED");
		return {
			runner,
			source,
			trash
		};
	}
	async acquire(record, permit, signal) {
		let project, workspace;
		const p = record.basis.preservation;
		try {
			project = await this.preservations.options.fencer.acquire({
				kind: "project",
				directoryRoot: this.preservations.controlDataRoot,
				resourceId: p.basis.repository.resourceId,
				operationId: record.operationId
			}, signal);
			workspace = await this.preservations.options.fencer.acquire({
				kind: "workspace",
				directoryRoot: this.preservations.runnerDataRoot,
				resourceId: record.workspaceRef,
				operationId: record.operationId,
				permit,
				purpose: "cleanup"
			}, signal);
			return { release: async () => {
				await workspace.release();
				await project.release();
			} };
		} catch (error) {
			if (project) await project.release();
			throw error;
		}
	}
	receiptPath(record, phase) {
		return join(this.preservations.runnerDataRoot, "registry", "workspace-reclamations", record.workspaceRef, record.operationId, phase + ".json");
	}
	receiptBytes(record, phase) {
		return canonical({
			schemaVersion: "devmesh.workspace-reclamation-receipt.v1",
			phase,
			operationId: record.operationId,
			requestHash: record.requestHash,
			workspaceRef: record.workspaceRef,
			preservationOperationId: record.preservationOperationId,
			manifestSha256: record.basis.preservation.acknowledgement.manifestSha256,
			identity: record.basis.preservation.manifest.snapshot.identity,
			sourcePath: record.basis.sourcePath,
			trashPath: record.basis.trashPath
		});
	}
	async receipt(record, phase, create) {
		const path = this.receiptPath(record, phase), directory = dirname(path), bytes = this.receiptBytes(record, phase);
		if (create) {
			canonicalRoot(this.preservations.runnerDataRoot);
			canonicalRoot(directory);
			await mkdir(directory, {
				recursive: true,
				mode: 448
			});
			canonicalRoot(directory);
			if (!await stat(path)) {
				const handle = await open(path, "wx", 384);
				try {
					await handle.writeFile(bytes);
					await handle.sync();
				} finally {
					await handle.close();
				}
				await sync(directory);
			}
		}
		canonicalRoot(directory);
		const found = await stat(path);
		if (!found?.isFile() || found.isSymbolicLink() || found.nlink !== 1n || found.size > 32768n || await readFile(path, "utf8") !== bytes) fail$1("WORKSPACE_RECLAMATION_RECEIPT_CHANGED");
		return hash(bytes);
	}
	async original(record, path) {
		const found = await stat(path), identity = record.basis.preservation.manifest.snapshot.identity;
		if (!found) return false;
		if (!found.isDirectory() || found.isSymbolicLink() || String(found.dev) !== identity.device || String(found.ino) !== identity.fileId || await realpath(path) !== path) fail$1("WORKSPACE_RECLAMATION_ROOT_CHANGED");
		return true;
	}
	async relocated(record, signal) {
		const { source, trash } = await this.paths(record);
		if (await stat(source) || !await this.original(record, trash)) fail$1("WORKSPACE_RECLAMATION_ISOLATION_UNKNOWN");
		const { sha256: _sha, ...facts } = record.basis.preservation.manifest.snapshot, changed = {
			...facts,
			root: trash
		};
		await verifyWorkspaceMaterials({
			...changed,
			sha256: hash(canonical(changed))
		}, baseFiles(record.basis.preservation), signal);
		const p = record.basis.preservation, a = p.basis.allocation, workspace = await ControlledGit.open(join(trash, "repo"), "checkout"), root = await lstat(workspace.identity.root, { bigint: true }), git = await lstat(workspace.identity.gitDirectory, { bigint: true });
		if (String(root.dev) !== a.identity.rootDevice || String(root.ino) !== a.identity.rootFileId || String(git.dev) !== a.identity.gitDevice || String(git.ino) !== a.identity.gitFileId || await workspace.head(signal) !== a.baseCommit) fail$1("WORKSPACE_RECLAMATION_SOURCE_CHANGED");
		await workspace.verifyAttemptBranch(a.baseCommit, a.attemptId, signal);
		await workspace.verifyPreservationBasis(a.baseCommit, [
			{
				ref: "refs/devmesh/allocations/" + a.operationId,
				commit: a.baseCommit
			},
			{
				ref: "refs/heads/devmesh/" + a.attemptId,
				commit: a.baseCommit
			},
			...p.basis.commits.map((c) => ({
				ref: c.ref,
				commit: c.commit
			}))
		], signal);
	}
	async closed(record, permit, signal, verifyPhysical = false) {
		const current = await this.storage.request("assertWorkspaceReclamationReady", {
			permit,
			operationId: record.operationId
		});
		if (canonical(current.basis) !== canonical(record.basis) || current.requestHash !== record.requestHash) fail$1("WORKSPACE_RECLAMATION_BASIS_CHANGED");
		await this.paths(current);
		if (verifyPhysical) await this.preservations.verifyArchiveProof({
			permit,
			operationId: record.preservationOperationId,
			manifestSha256: record.basis.preservation.acknowledgement.manifestSha256
		}, signal);
		return current;
	}
	async observeReply(action, record, permit, predicate) {
		try {
			return await action();
		} catch (error) {
			const observed = await this.storage.request("getWorkspaceReclamation", {
				permit,
				operationId: record.operationId
			}).catch(() => null);
			if (!observed || observed.requestHash !== record.requestHash || !predicate(observed)) throw error;
			return observed;
		}
	}
	async reclaim(input, signal = new AbortController().signal) {
		const { created: _created, ...pending } = await this.storage.request("beginWorkspaceReclamation", input);
		let record = pending;
		if (record.state === "DELETED") return record;
		const retainedSince = Math.max(Date.parse(record.createdAt), Date.parse(record.basis.preservation.acknowledgedAt ?? ""));
		if (!Number.isFinite(retainedSince) || Date.now() - retainedSince < this.retentionMs) fail$1("WORKSPACE_RECLAMATION_RETENTION_ACTIVE");
		const fence = await this.acquire(record, input.permit, signal);
		try {
			record = await this.closed(record, input.permit, signal, true);
			const { source, trash } = await this.paths(record), proof = {
				permit: input.permit,
				operationId: record.operationId,
				requestHash: record.requestHash
			};
			canonicalRoot(dirname(source));
			if (record.state === "PREPARED") {
				await this.preservations.verifyReclaimable({
					permit: input.permit,
					operationId: record.preservationOperationId,
					manifestSha256: record.basis.preservation.acknowledgement.manifestSha256
				}, signal);
				if (!await this.original(record, source) || await stat(trash)) fail$1("WORKSPACE_RECLAMATION_ISOLATION_UNKNOWN");
				const receiptSha256 = await this.receipt(record, "isolation-intent", true);
				record = await this.observeReply(() => this.storage.request("markWorkspaceIsolationSent", {
					...proof,
					receiptSha256
				}), record, input.permit, (r) => r.isolationIntentSha256 === receiptSha256);
			}
			if (record.state === "ISOLATION_SENT") {
				if (await this.receipt(record, "isolation-intent", false) !== record.isolationIntentSha256) fail$1("WORKSPACE_RECLAMATION_INTENT_CHANGED");
				const sourceExists = await this.original(record, source);
				if (sourceExists === await this.original(record, trash)) fail$1("WORKSPACE_RECLAMATION_ISOLATION_UNKNOWN");
				if (sourceExists) {
					await this.preservations.verifyReclaimable({
						permit: input.permit,
						operationId: record.preservationOperationId,
						manifestSha256: record.basis.preservation.acknowledgement.manifestSha256
					}, signal);
					canonicalRoot(dirname(trash));
					await mkdir(dirname(trash), {
						recursive: true,
						mode: 448
					});
					canonicalRoot(dirname(trash));
					if (await stat(trash) || !await this.original(record, source)) fail$1("WORKSPACE_RECLAMATION_ROOT_CHANGED");
					await this.closed(record, input.permit, signal);
					signal.throwIfAborted();
					await rename(source, trash);
					await sync(dirname(source));
					await sync(dirname(trash));
				}
				await this.relocated(record, signal);
				const receiptSha256 = await this.receipt(record, "isolated", true), isolation = {
					sourceAbsent: true,
					trashIdentity: record.basis.preservation.manifest.snapshot.identity,
					manifestSha256: record.basis.preservation.acknowledgement.manifestSha256,
					receiptSha256
				};
				record = await this.observeReply(() => this.storage.request("acknowledgeWorkspaceIsolation", {
					...proof,
					proof: isolation
				}), record, input.permit, (r) => canonical(r.isolationProof) === canonical(isolation));
			}
			if (record.state === "ISOLATED") {
				if (await this.receipt(record, "isolated", false) !== record.isolationProof?.receiptSha256) fail$1("WORKSPACE_RECLAMATION_RECEIPT_CHANGED");
				await this.relocated(record, signal);
				await this.closed(record, input.permit, signal);
				const receiptSha256 = await this.receipt(record, "delete-intent", true);
				record = await this.observeReply(() => this.storage.request("markWorkspaceDeletionSent", {
					...proof,
					receiptSha256
				}), record, input.permit, (r) => r.deleteIntentSha256 === receiptSha256);
			}
			if (record.state === "DELETE_SENT") {
				if (await this.receipt(record, "isolated", false) !== record.isolationProof?.receiptSha256 || await this.receipt(record, "delete-intent", false) !== record.deleteIntentSha256) fail$1("WORKSPACE_RECLAMATION_RECEIPT_CHANGED");
				await this.closed(record, input.permit, signal, true);
				canonicalRoot(dirname(trash));
				if (await stat(source)) fail$1("WORKSPACE_RECLAMATION_SOURCE_REAPPEARED");
				if (await this.original(record, trash)) {
					await verifyWorkspaceRemnants(record.basis.preservation.manifest.snapshot, trash, signal);
					if (resolve(trash) !== record.basis.trashPath || !await this.original(record, trash) || await stat(source)) fail$1("WORKSPACE_RECLAMATION_ROOT_CHANGED");
					signal.throwIfAborted();
					await rm(trash, {
						recursive: true,
						force: false,
						maxRetries: 0
					});
					await sync(dirname(trash));
				}
				if (await stat(source) || await stat(trash)) fail$1("WORKSPACE_RECLAMATION_DELETION_UNKNOWN");
				const deletion = {
					sourceAbsent: true,
					trashAbsent: true,
					receiptSha256: await this.receipt(record, "deleted", true)
				};
				record = await this.observeReply(() => this.storage.request("acknowledgeWorkspaceDeletion", {
					...proof,
					proof: deletion
				}), record, input.permit, (r) => canonical(r.deletionProof) === canonical(deletion));
			}
			if (record.state !== "DELETED") fail$1("WORKSPACE_RECLAMATION_UNRESOLVED");
			return record;
		} catch (error) {
			await this.storage.request("markWorkspaceReclamationUncertain", {
				permit: input.permit,
				operationId: record.operationId,
				requestHash: record.requestHash,
				errorCode: error.code ?? "WORKSPACE_RECLAMATION_EFFECT_UNKNOWN"
			}).catch(() => void 0);
			throw error;
		} finally {
			await fence.release();
		}
	}
	async reconcile(input, signal = new AbortController().signal) {
		const original = await this.storage.request("getWorkspaceReclamation", input);
		return this.reclaim({
			...input,
			preservationOperationId: original.preservationOperationId
		}, signal);
	}
};
//#endregion
//#region src/maintenance-authority.ts
/** Explicit local-development bridge for the Runner's separate cleanup scope.
* The Runner authenticates controllerId before invoking this callback. Normal
* execution authority and workspace admission are configured separately. */
function createLocalWorkspaceCleanupAuthority(options) {
	if (options.mode !== "local-development" || !options.storage || !options.controllerId || !options.runnerId) throw new WorkspaceError("WORKSPACE_MAINTENANCE_NOT_CONFIGURED");
	return async (controllerId, permit, workspaceRef, parentOperationId) => {
		if (controllerId !== options.controllerId) throw new WorkspaceError("WORKSPACE_MAINTENANCE_CONTROLLER_DENIED");
		const record = await options.storage.request("authorizeWorkspaceMaintenance", {
			permit,
			workspaceRef,
			operationId: parentOperationId,
			runnerId: options.runnerId
		});
		if (record.operationId !== parentOperationId || record.workspaceRef !== workspaceRef || record.runnerId !== options.runnerId || permit.ownerKind !== "workflowAttempt" || record.attemptId !== permit.attemptId || record.activationId !== permit.activationId || record.grantId !== permit.grantId) throw new WorkspaceError("WORKSPACE_MAINTENANCE_DENIED");
	};
}
/** Local managed-code execution, allocation fencing and cleanup all resolve
* committed SQLite authority. A partial allocation can be fenced for recovery,
* but it cannot admit a new job until its original READY fact exists. */
function createLocalManagedRunnerAuthority(options) {
	const cleanup = createLocalWorkspaceCleanupAuthority(options);
	const verify = async (controllerId, permit, workspaceRef, purpose) => {
		if (controllerId !== options.controllerId) throw new WorkspaceError("WORKSPACE_MAINTENANCE_CONTROLLER_DENIED");
		const record = await options.storage.request("authorizeManagedWorkspaceAccess", {
			permit,
			workspaceRef,
			runnerId: options.runnerId,
			purpose
		});
		if (record.workspaceRef !== workspaceRef || record.runnerId !== options.runnerId || permit.ownerKind !== "workflowAttempt" || record.attemptId !== permit.attemptId || record.activationId !== permit.activationId || record.grantId !== permit.grantId) throw new WorkspaceError("WORKSPACE_EXECUTION_DENIED");
	};
	return {
		verify: (controller, request, permit) => verify(controller, permit, request.workspaceRef, "execution"),
		verifyWorkspace: (controller, permit, workspaceRef) => verify(controller, permit, workspaceRef, "fence"),
		verifyWorkspaceCleanup: cleanup
	};
}
//#endregion
//#region src/managed-bindings.ts
/** Trusted MCP resolver. Filesystem identity comes from the original durable
* allocation ACK, including on the very first tool call after startup. */
function createLocalManagedBindingResolver(options) {
	if (options.mode !== "local-development") throw new WorkspaceError("WORKSPACE_BACKEND_NOT_CONFIGURED");
	opaqueKey.parse(options.runnerId);
	const root = canonicalRoot(options.runnerDataRoot);
	return async (workspaceRef, permit) => {
		const { allocation: a, repository: r } = await options.storage.request("getManagedWorkspaceBinding", {
			workspaceRef,
			permit: executionPermit.parse(permit),
			runnerId: options.runnerId
		}), identity = a.identity;
		const expected = join(await realpath(root), "workspaces", a.attemptId, "repo");
		if (identity.root !== expected || identity.gitDirectory !== join(expected, ".git") || identity.commonDirectory !== identity.gitDirectory) throw new WorkspaceError("WORKSPACE_REPO_BINDING_CHANGED");
		return {
			workspaceRef: a.workspaceRef,
			resourceId: a.workspaceRef,
			projectResourceId: r.resourceId,
			projectId: a.projectId,
			runId: a.runId,
			attemptId: a.attemptId,
			baseCommit: a.baseCommit,
			root: identity.root,
			gitDirectory: identity.gitDirectory,
			commonDirectory: identity.commonDirectory,
			identity: structuredClone(identity)
		};
	};
}
//#endregion
//#region src/runtime-lifecycle.ts
const fail = (code) => {
	throw new WorkspaceError(code);
};
/** Local-only deployment composition. Physical paths stay in trusted backends. */
function createLocalManagedRuntimeLifecycle(options) {
	if (options.mode !== "local-development" || options.allocator.options.storage !== options.archives.options.storage || options.allocator.options.fencer !== options.archives.options.fencer || options.allocator.controlDataRoot !== options.archives.controlDataRoot || options.allocator.runnerDataRoot !== options.archives.runnerDataRoot) fail("RUNTIME_WORKSPACE_BACKEND_CHANGED");
	const { allocator, archives } = options, config = Object.freeze({
		schemaVersion: "devmesh.managed-runtime.v1",
		runnerId: allocator.options.runnerId
	});
	const permit = (host) => {
		const p = parseContract(executionPermit, host.permit);
		if (p.ownerKind !== "workflowAttempt" || p.activationId !== host.activationId || p.attemptId !== host.attemptId || p.grantId !== host.grantId || p.runId !== host.runId) fail("RUNTIME_WORKSPACE_OWNER_CHANGED");
		return p;
	};
	const bound = async (host, result) => {
		if (result.activationId !== host.activationId) fail("RUNTIME_WORKSPACE_OWNER_CHANGED");
		const p = permit(host), a = await allocator.options.storage.request("getWorkspaceAllocation", {
			permit: p,
			operationId: result.allocationOperationId
		});
		if (a.runnerId !== config.runnerId || a.state !== "READY" || a.baseCommit !== host.inputManifest.codeCommit) fail("RUNTIME_WORKSPACE_ALLOCATION_UNPROVEN");
		return p;
	};
	return {
		config,
		async prepare(host, signal) {
			const p = permit(host), workspaces = p.resources.filter((r) => r.kind === "workspace" && r.access === "write"), repos = p.resources.filter((r) => r.kind === "projectRepository");
			if (workspaces.length !== 1 || repos.length !== 1) fail("RUNTIME_WORKSPACE_RESOURCE_UNPROVEN");
			const role = host.roleSnapshot.role;
			if (role !== "developer" && role !== "tester") fail("RUNTIME_WORKSPACE_ROLE_CHANGED");
			const operationId = "op_" + createHash("sha256").update("runtime-workspace\0" + host.activationId).digest("hex");
			const { record } = await allocator.allocate({
				permit: p,
				operationId,
				workspaceRef: workspaces[0].resourceId,
				repositoryResourceId: repos[0].resourceId,
				runnerId: config.runnerId,
				kind: role === "developer" ? "development" : "verification",
				baseCommit: parseContract(gitCommit, host.inputManifest.codeCommit)
			}, signal);
			return {
				schemaVersion: "devmesh.runtime-workspace.v1",
				workspaceRef: record.workspaceRef,
				allocationOperationId: record.operationId,
				baseCommit: record.baseCommit,
				manifestSha256: record.manifest.sha256
			};
		},
		async retain(host, result, signal) {
			const p = await bound(host, result);
			if (!result.archiveOperationId) return;
			if ((await archives.archive({
				permit: p,
				operationId: result.archiveOperationId,
				allocationOperationId: result.allocationOperationId,
				commitOperationId: result.commitOperationId
			}, signal)).state !== "ACKNOWLEDGED") throw new WorkspaceError("RUNTIME_SOURCE_ARCHIVE_UNACKNOWLEDGED", "unknown");
		},
		async reconcile(host, result, signal) {
			const p = await bound(host, result);
			if (!result.archiveOperationId) return;
			const original = await archives.options.storage.request("getSourceArchive", {
				permit: p,
				operationId: result.archiveOperationId
			});
			if (original.allocationOperationId !== result.allocationOperationId || original.commitOperationId !== result.commitOperationId) fail("RUNTIME_SOURCE_ARCHIVE_BASIS_CHANGED");
			const record = await archives.reconcile({
				permit: p,
				operationId: result.archiveOperationId
			}, signal);
			if (record.state !== "ACKNOWLEDGED" || canonical(record.basis.allocation) !== canonical(original.basis.allocation)) throw new WorkspaceError("RUNTIME_SOURCE_ARCHIVE_UNACKNOWLEDGED", "unknown");
		}
	};
}
//#endregion
//#region src/release-export-sources.ts
/** Read immutable accepted source objects; never enter a live workspace. */
var LocalReleaseExportSources = class {
	root;
	constructor(controlDataRoot) {
		this.root = canonicalRoot(controlDataRoot);
	}
	async read(context, signal) {
		const s = context.snapshot, { identity, manifest } = s.source;
		if (identity.root !== join(await realpath(this.root), "repositories", s.release.projectId, "repo.git")) throw new WorkspaceError("EXPORT_SOURCE_CHANGED");
		const git = await ControlledGit.open(identity.root, "bare"), [r, g] = await Promise.all([lstat(git.identity.root, { bigint: true }), lstat(git.identity.gitDirectory, { bigint: true })]);
		if (canonical({
			root: git.identity.root,
			gitDirectory: git.identity.gitDirectory,
			commonDirectory: git.identity.commonDirectory,
			rootDevice: String(r.dev),
			rootFileId: String(r.ino),
			gitDevice: String(g.dev),
			gitFileId: String(g.ino)
		}) !== canonical(identity) || canonical(await git.manifest(s.codeCommit, signal)) !== canonical(manifest)) throw new WorkspaceError("EXPORT_SOURCE_CHANGED");
		const files = [];
		for (const f of manifest.files) {
			signal.throwIfAborted();
			files.push({
				path: f.path,
				bytes: await git.readBlob(f.objectId, signal),
				mode: f.mode
			});
		}
		await git.validate(signal);
		return files;
	}
};
//#endregion
export { ControlledGit, LocalCandidateConflicts, LocalCandidateIntegrations, LocalManagedWorkspaces, LocalReleaseExportSources, LocalRunnerWorkspaceFencer, LocalSourceArchives, LocalWorkspacePreservations, LocalWorkspaceReclamations, WorkspaceError, captureWorkspaceMaterials, createLocalManagedBindingResolver, createLocalManagedRunnerAuthority, createLocalManagedRuntimeLifecycle, createLocalRepoAcquire, createLocalWorkspaceCleanupAuthority, verifyWorkspaceMaterials, verifyWorkspaceRemnants };

//# sourceMappingURL=index.mjs.map