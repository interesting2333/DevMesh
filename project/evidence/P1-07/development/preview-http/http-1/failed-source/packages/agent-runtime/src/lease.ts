import {executionPermit} from '@devmesh/contracts';
import type {ExecutionPermit} from '@devmesh/contracts';
import type {SqliteStorage} from '@devmesh/storage-sqlite';
import type {ExecutionClaim} from './runtime.js';

/** A claimed, live Host can renew the same grant; expiry cannot be revived. */
export class ExecutionGrantLease {
  readonly #abort=new AbortController();#timer:NodeJS.Timeout|undefined;#pending:Promise<void>|undefined;#stopped=false;
  get signal(){return this.#abort.signal;}
  constructor(readonly storage:SqliteStorage,readonly claim:ExecutionClaim,readonly update:(permit:ExecutionPermit)=>void){}
  async start(){
    if(this.#timer||this.#stopped)throw new Error('Execution grant lease cannot restart');
    await this.renew();if(this.#stopped)return;
    this.#timer=setInterval(()=>{if(!this.#pending&&!this.#stopped){this.#pending=this.renew().catch(()=>{this.#abort.abort();if(this.#timer)clearInterval(this.#timer);}).finally(()=>{this.#pending=undefined;});}},5000);this.#timer.unref();
  }
  private async renew(){const value=await this.storage.request('renewExecutionHost',this.claim);if(!this.#stopped)this.update(executionPermit.parse(value.permit));}
  async stop(){this.#stopped=true;if(this.#timer)clearInterval(this.#timer);await this.#pending;}
}
