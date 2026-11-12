import { DatabaseSync } from "node:sqlite";

//#region src/migrations.d.ts
interface Migration {
  version: number;
  name: string;
  sha256: string;
  sql: string;
}
declare const digest: (value: string | Uint8Array) => string;
declare function readMigrations(directory?: string): Migration[];
declare function transaction<T>(db: DatabaseSync, fn: () => T): T;
declare function checkHistory(db: DatabaseSync, migrations: readonly Migration[]): number;
declare function applyMigrations(db: DatabaseSync, migrations: readonly Migration[], storeId: string, layoutVersion?: number, targetVersion?: number): number;
declare function backupBeforeUpgrade(db: DatabaseSync, databasePath: string, backupDirectory: string | undefined): Promise<string>;
//#endregion
export { Migration, applyMigrations, backupBeforeUpgrade, checkHistory, digest, readMigrations, transaction };
//# sourceMappingURL=migrations.d.mts.map