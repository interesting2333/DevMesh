import type {DatabaseSync} from 'node:sqlite';

/** Old migration/backup readers retain their original manual-only semantics. */
export function planAdmissionTable(db:DatabaseSync):'plan_execution_admissions'|'plan_confirmations'{
 return Number(db.prepare('PRAGMA user_version').get()!.user_version)>=55?'plan_execution_admissions':'plan_confirmations';
}
