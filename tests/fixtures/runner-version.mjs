import {readFileSync} from 'node:fs';
// A dedicated temporary historical fixture, never a production downgrade.
// Restore the unchanged v3 parent CHECK before emulating a pre-v6 store.
export function historicalV5Fixture(db){
  historicalV6Fixture(db);
 if(db.prepare('PRAGMA user_version').get().user_version!==6||db.prepare("SELECT 1 FROM preview_reservations WHERE state='REMOVED'").get())throw Error('Not a compatible dedicated v6 fixture');
 const old=readFileSync(new URL('../../packages/runner/src/capacity-domain.ts',import.meta.url),'utf8').match(/const migration=`([\s\S]*?)`;/)[1],lines=old.split('\n'),table=lines.find(l=>l.startsWith('CREATE TABLE preview_reservations(')).replace('CREATE TABLE preview_reservations(','CREATE TABLE preview_reservations_fixture('),indexes=lines.filter(l=>l.startsWith('CREATE UNIQUE INDEX exclusive_preview_')),triggers=lines.filter(l=>l.startsWith('CREATE TRIGGER immutable_preview_reservation ')||l.startsWith('CREATE TRIGGER preserve_preview_reservation '));
 db.exec('PRAGMA foreign_keys=OFF');try{db.exec('BEGIN IMMEDIATE');db.exec(['DROP TABLE preview_cleanup_actions;',table,'INSERT INTO preview_reservations_fixture SELECT * FROM preview_reservations;','DROP TABLE preview_reservations;','ALTER TABLE preview_reservations_fixture RENAME TO preview_reservations;',...indexes,'CREATE UNIQUE INDEX preview_reservation_request_binding ON preview_reservations(reservation_id,request_hash);',...triggers,'ALTER TABLE runner_identity RENAME TO runner_identity_v6_fixture;','CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=5)) STRICT;','INSERT INTO runner_identity SELECT singleton,runner_id,5 FROM runner_identity_v6_fixture;','DROP TABLE runner_identity_v6_fixture;','DELETE FROM runner_schema_history WHERE version=6;','PRAGMA user_version=5;'].join('\n'));if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Invalid historical fixture');db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}finally{db.exec('PRAGMA foreign_keys=ON');}
}

// Remove only empty v7 service structures in a dedicated historical test store.
export function historicalV6Fixture(db){
 historicalV7Fixture(db);
 if(db.prepare('PRAGMA user_version').get().user_version===6)return;
 if(db.prepare('PRAGMA user_version').get().user_version!==7||db.prepare('SELECT count(*) n FROM acceptance_services').get().n!==0)throw Error('Not a compatible dedicated v7 fixture');
 db.exec('BEGIN IMMEDIATE');try{db.exec("DROP TABLE acceptance_service_actions; DROP TABLE acceptance_service_profiles; DROP TABLE acceptance_service_events; DROP TABLE acceptance_services; ALTER TABLE runner_identity RENAME TO runner_identity_v7_fixture; CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=6)) STRICT; INSERT INTO runner_identity SELECT singleton,runner_id,6 FROM runner_identity_v7_fixture; DROP TABLE runner_identity_v7_fixture; DELETE FROM runner_schema_history WHERE version=7; PRAGMA user_version=6;");if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Invalid v6 fixture');db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
}

// Remove only empty v8 proof structures in a dedicated historical test store.
export function historicalV7Fixture(db){
 historicalV8Fixture(db);
 if(db.prepare('PRAGMA user_version').get().user_version===7||db.prepare('PRAGMA user_version').get().user_version===6)return;
 if(db.prepare('PRAGMA user_version').get().user_version!==8||db.prepare('SELECT count(*) n FROM acceptance_service_proofs').get().n!==0)throw Error('Not a compatible dedicated v8 fixture');
 db.exec('BEGIN IMMEDIATE');try{db.exec("DROP TABLE acceptance_service_proofs; ALTER TABLE runner_identity RENAME TO runner_identity_v8_fixture; CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=7)) STRICT; INSERT INTO runner_identity SELECT singleton,runner_id,7 FROM runner_identity_v8_fixture; DROP TABLE runner_identity_v8_fixture; DELETE FROM runner_schema_history WHERE version=8; PRAGMA user_version=7;");if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Invalid v7 fixture');db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
}

// Reconstruct the exact old parent only in a dedicated test store. No production downgrade.
export function historicalV8Fixture(db){
 historicalV9Fixture(db);
 const version=db.prepare('PRAGMA user_version').get().user_version;if(version<9)return;
 if(version!==9||db.prepare('SELECT count(*) n FROM acceptance_service_aborts').get().n||db.prepare("SELECT 1 FROM acceptance_services WHERE state='REMOVED'").get())throw Error('Not a compatible dedicated v9 fixture');
 const old=readFileSync(new URL('../../packages/runner/src/acceptance-service-migration.ts',import.meta.url),'utf8').match(/Migration=`([\s\S]*?)`;/)[1].split('\n'),table=old.find(l=>l.startsWith('CREATE TABLE acceptance_services(')).replace('acceptance_services(','acceptance_services_fixture('),indexes=old.filter(l=>l.startsWith('CREATE UNIQUE INDEX exclusive_acceptance_service_')),triggers=old.filter(l=>l.startsWith('CREATE TRIGGER immutable_acceptance_service ')||l.startsWith('CREATE TRIGGER preserve_acceptance_service '));
 db.exec('PRAGMA foreign_keys=OFF');try{db.exec('BEGIN IMMEDIATE');db.exec(['DROP TRIGGER aborted_acceptance_action;','DROP TRIGGER aborted_acceptance_proof;','DROP TABLE acceptance_abort_actions;','DROP TABLE acceptance_service_aborts;',table,'INSERT INTO acceptance_services_fixture SELECT * FROM acceptance_services;','DROP TABLE acceptance_services;','ALTER TABLE acceptance_services_fixture RENAME TO acceptance_services;',...indexes,...triggers,'ALTER TABLE runner_identity RENAME TO runner_identity_v9_fixture;','CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=8)) STRICT;','INSERT INTO runner_identity SELECT singleton,runner_id,8 FROM runner_identity_v9_fixture;','DROP TABLE runner_identity_v9_fixture;','DELETE FROM runner_schema_history WHERE version=9;','PRAGMA user_version=8;'].join('\n'));if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Invalid v8 fixture');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}finally{db.exec('PRAGMA foreign_keys=ON');}
}

// Remove only empty v10 structures in a dedicated compatibility test store.
// Production migrations remain forward-only and never call this helper.
export function historicalV9Fixture(db){
 historicalV10Fixture(db);
 const version=db.prepare('PRAGMA user_version').get().user_version;if(version<10)return;
 if(version!==10||db.prepare('SELECT count(*) n FROM release_retirements').get().n||db.prepare('SELECT count(*) n FROM release_retirement_actions').get().n)throw Error('Not a compatible dedicated v10 fixture');
 db.exec('BEGIN IMMEDIATE');try{
  const triggers=db.prepare("SELECT name FROM sqlite_schema WHERE type='trigger' AND (tbl_name IN ('release_retirements','release_retirement_actions') OR name IN ('publishing_acceptance_abort','aborting_release_retirement','publishing_acceptance_action','publishing_acceptance_action_observation','publishing_acceptance_proof','publishing_acceptance_service','publishing_preview_reservation','publishing_acceptance_reservation'))").all();
  for(const r of triggers)db.exec('DROP TRIGGER '+r.name);
  db.exec('DROP TABLE release_retirement_actions; DROP TABLE release_retirements; ALTER TABLE runner_identity RENAME TO runner_identity_v10_fixture; CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=9)) STRICT; INSERT INTO runner_identity SELECT singleton,runner_id,9 FROM runner_identity_v10_fixture; DROP TABLE runner_identity_v10_fixture; DELETE FROM runner_schema_history WHERE version=10; PRAGMA user_version=9;');
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Invalid v9 fixture');db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}

// Dedicated compatibility fixture only: remove empty v11 structures. Production
// opens run only forward migrations. Retain all original v10 rows and hashes.
export function historicalV10Fixture(db){
  historicalV11Fixture(db);
 const version=db.prepare('PRAGMA user_version').get().user_version;if(version<11)return;
 if(version!==11||db.prepare('SELECT count(*) n FROM release_service_handoffs').get().n)throw Error('Not a compatible dedicated v11 fixture');
 db.exec('BEGIN IMMEDIATE');try{db.exec('DROP TRIGGER retired_source_service; DROP TABLE release_service_proofs; DROP TABLE release_service_actions; DROP TABLE release_service_events; DROP TABLE release_service_profiles; DROP TABLE release_service_reservations; DROP TABLE release_service_handoffs; ALTER TABLE runner_identity RENAME TO runner_identity_v11_fixture; CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=10)) STRICT; INSERT INTO runner_identity SELECT singleton,runner_id,10 FROM runner_identity_v11_fixture; DROP TABLE runner_identity_v11_fixture; DELETE FROM runner_schema_history WHERE version=11; PRAGMA user_version=10;');if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Invalid v10 fixture');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}

// Dedicated v11 reconstruction: keep every old action byte, never fabricate a
// completed quota phase. A store with a new v12 quota action is not compatible.
export function historicalV11Fixture(db){
 const version=db.prepare('PRAGMA user_version').get().user_version;if(version<12)return;
 if(version!==12||db.prepare("SELECT 1 FROM release_service_actions WHERE kind='PROFILE_PREPARE'").get())throw Error('Not a compatible dedicated v12 fixture');
 const sql=readFileSync(new URL('../../packages/runner/src/release-service-migration.ts',import.meta.url),'utf8').match(/Migration=`([\s\S]*?)`;/)[1],lines=sql.split('\n');
 const table=lines.find(l=>l.startsWith('CREATE TABLE release_service_actions(')).replace('release_service_actions(','release_service_actions_v11_fixture(');
 const triggers=lines.filter(l=>l.startsWith('CREATE TRIGGER immutable_release_service_action ')||l.startsWith('CREATE TRIGGER preserve_release_service_action '));
 const retired=sql.match(/CREATE TRIGGER retired_source_service[\s\S]*?END;/)[0];
 db.exec('BEGIN IMMEDIATE');try{
  db.exec(['DROP TRIGGER retired_source_service;',table,'INSERT INTO release_service_actions_v11_fixture SELECT * FROM release_service_actions;','DROP TABLE release_service_actions;','ALTER TABLE release_service_actions_v11_fixture RENAME TO release_service_actions;',...triggers,retired,'DROP TABLE release_profile_preparations;','ALTER TABLE runner_identity RENAME TO runner_identity_v12_fixture;','CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=11)) STRICT;','INSERT INTO runner_identity SELECT singleton,runner_id,11 FROM runner_identity_v12_fixture;','DROP TABLE runner_identity_v12_fixture;','DELETE FROM runner_schema_history WHERE version=12;','PRAGMA user_version=11;'].join('\n'));
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Invalid v11 fixture');db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
