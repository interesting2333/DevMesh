import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync, backup } from "node:sqlite";
import { fileURLToPath } from "node:url";
//#region src/errors.ts
var StorageError = class extends Error {
	code;
	status;
	details;
	constructor(code, status, message, details = {}) {
		super(message);
		this.name = "StorageError";
		this.code = code;
		this.status = status;
		this.details = details;
	}
};
function failure(error) {
	if (error instanceof StorageError) return {
		code: error.code,
		status: error.status,
		message: error.message,
		details: error.details
	};
	const e = error;
	if (e.code === "ERR_SQLITE_ERROR") {
		const primary = (e.errcode ?? 0) & 255;
		const busy = primary === 5 || primary === 6;
		return {
			code: busy ? "STORAGE_BUSY" : primary === 19 ? "STORAGE_CONSTRAINT" : "STORAGE_FAILURE",
			status: busy ? 503 : primary === 19 ? 409 : 500,
			message: e.message ?? "SQLite operation failed",
			details: { sqliteCode: e.errcode }
		};
	}
	return {
		code: e.code ?? "STORAGE_FAILURE",
		status: e.status ?? 500,
		message: e.message ?? String(error),
		details: e.details ?? {}
	};
}
//#endregion
//#region src/migrations.ts
const digest = (value) => createHash("sha256").update(value).digest("hex");
function readMigrations(directory = fileURLToPath(new URL("./migrations/", import.meta.url))) {
	return JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8")).map((entry, index) => {
		if (entry.version !== index + 1 || !/^\d{4}-[a-z]+\.sql$/.test(entry.name)) throw new StorageError("MIGRATION_MANIFEST_INVALID", 500, "Migration versions/names are invalid");
		const sql = readFileSync(resolve(directory, entry.name), "utf8");
		if (digest(sql) !== entry.sha256) throw new StorageError("MIGRATION_CHECKSUM_MISMATCH", 500, `Migration content changed: ${entry.name}`);
		return {
			...entry,
			sql
		};
	});
}
function transaction(db, fn) {
	db.exec("BEGIN IMMEDIATE");
	try {
		const value = fn();
		if (value && typeof value.then === "function") throw new StorageError("ASYNC_TRANSACTION_FORBIDDEN", 500, "Transactions cannot await");
		db.exec("COMMIT");
		return value;
	} catch (error) {
		if (db.isTransaction) db.exec("ROLLBACK");
		throw error;
	}
}
function checkHistory(db, migrations) {
	if (!db.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").get()) {
		if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get()) throw new StorageError("DATABASE_UNRECOGNIZED", 409, "Refusing an unrecognized database");
		return 0;
	}
	const rows = db.prepare("SELECT version,name,sha256 FROM schema_migrations ORDER BY version").all();
	for (const [index, row] of rows.entries()) {
		const expected = migrations[index];
		if (!expected || row.version !== expected.version || row.name !== expected.name || row.sha256 !== expected.sha256) throw new StorageError("MIGRATION_HISTORY_MISMATCH", 409, "Unknown, non-contiguous or changed migration history");
	}
	if (!rows.length) throw new StorageError("MIGRATION_HISTORY_MISMATCH", 409, "Uncommitted/empty migration history");
	if (db.prepare("PRAGMA user_version").get()?.user_version !== rows.length) throw new StorageError("MIGRATION_HISTORY_MISMATCH", 409, "SQLite version marker differs from migration history");
	return rows.length;
}
function applyMigrations(db, migrations, storeId, layoutVersion = 1, targetVersion = migrations.length) {
	let version = checkHistory(db, migrations);
	if (!Number.isInteger(targetVersion) || targetVersion < version || targetVersion < 1 || targetVersion > migrations.length) throw new StorageError("MIGRATION_DOWNGRADE_FORBIDDEN", 409, "Unsupported migration target");
	if (version > 0) {
		const identity = db.prepare("SELECT store_id,layout_version FROM store_metadata WHERE singleton_id=1").get();
		if (identity?.store_id !== storeId || identity.layout_version !== layoutVersion) throw new StorageError("STORE_IDENTITY_MISMATCH", 409, "storeId/layoutVersion does not match");
	}
	for (const migration of migrations.slice(version, targetVersion)) {
		const rebuild = migration.sql.startsWith("-- devmesh:foreign-key-rebuild\n");
		if (rebuild && db.isTransaction) throw new StorageError("MIGRATION_TRANSACTION_ACTIVE", 409, "A foreign-key rebuild requires an exclusive startup connection outside a transaction");
		const foreignKeys = Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys);
		if (rebuild) db.exec("PRAGMA foreign_keys=OFF");
		let failure;
		try {
			transaction(db, () => {
				if (version === 0) db.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL) STRICT;");
				db.exec(migration.sql);
				if (version === 0) db.prepare("INSERT INTO store_metadata VALUES(1,?,?,?)").run(storeId, layoutVersion, (/* @__PURE__ */ new Date()).toISOString());
				if (db.prepare("PRAGMA foreign_key_check").get()) throw new StorageError("MIGRATION_FOREIGN_KEY_FAILURE", 409, "Migration left invalid foreign keys");
				db.prepare("INSERT INTO schema_migrations VALUES(?,?,?,?)").run(migration.version, migration.name, migration.sha256, (/* @__PURE__ */ new Date()).toISOString());
				db.exec(`PRAGMA user_version=${migration.version}`);
			});
		} catch (error) {
			failure = { error };
		}
		if (rebuild) try {
			db.exec(foreignKeys ? "PRAGMA foreign_keys=ON" : "PRAGMA foreign_keys=OFF");
			if (Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys) !== foreignKeys) throw new StorageError("MIGRATION_FOREIGN_KEY_RESTORE_FAILED", 500, "Foreign-key enforcement was not restored");
		} catch (error) {
			if (failure) throw new AggregateError([failure.error, error], "Migration failed and foreign-key enforcement could not be restored");
			throw error;
		}
		if (failure) throw failure.error;
		version = migration.version;
	}
	return version;
}
async function backupBeforeUpgrade(db, databasePath, backupDirectory) {
	if (!backupDirectory || !isAbsolute(backupDirectory) || !existsSync(backupDirectory) || !statSync(backupDirectory).isDirectory()) throw new StorageError("UPGRADE_BACKUP_REQUIRED", 409, "Provide an existing absolute backup directory");
	const base = realpathSync(dirname(databasePath)), target = realpathSync(backupDirectory);
	const rel = relative(base, target);
	if (rel === "" || !rel.startsWith("..") && !isAbsolute(rel)) throw new StorageError("BACKUP_PATH_OVERLAP", 409, "Backup must be outside the database directory");
	const path = resolve(target, `devmesh-${Date.now()}-${randomUUID()}.sqlite`);
	await backup(db, path);
	const copy = new DatabaseSync(path);
	try {
		copy.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;");
		if (copy.prepare("PRAGMA quick_check").get()?.quick_check !== "ok" || copy.prepare("PRAGMA foreign_key_check").get()) throw new StorageError("BACKUP_INVALID", 500, "Backup integrity check failed");
	} finally {
		copy.close();
	}
	return path;
}
//#endregion
export { readMigrations as a, failure as c, digest as i, backupBeforeUpgrade as n, transaction as o, checkHistory as r, StorageError as s, applyMigrations as t };

//# sourceMappingURL=migrations-BsETEmRY.mjs.map