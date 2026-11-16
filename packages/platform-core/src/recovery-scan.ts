import {StorageError} from '@devmesh/storage-sqlite';
import type {SqliteStorage,RecoveryStateView} from '@devmesh/storage-sqlite';

/**
 * Read-only startup projection. It never mutates control gates, attempts, leases or
 * external operations; callers decide every follow-up action explicitly.
 */
export class RecoveryScan {
  constructor(readonly storage:Pick<SqliteStorage,'request'>){
    if(!storage||typeof storage.request!=='function')throw new StorageError('RECOVERY_SCAN_INVALID',422,'Storage request is required');
  }
  async scan():Promise<Readonly<RecoveryStateView>>{
    return Object.freeze(await this.storage.request('getRecoveryState',{}));
  }
}
