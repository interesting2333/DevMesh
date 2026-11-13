import {setTimeout as delay} from 'node:timers/promises';
import {ReleaseExporter} from '@devmesh/result-verifier';
import type {ReleaseExportSources} from '@devmesh/result-verifier';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Results} from '@devmesh/storage-sqlite';

export interface ReleaseExportSchedulerOptions {
  pollIntervalMs?: number;
  maxConcurrentJobs?: number;
  maxJobsPerPass?: number;
}

/** Consumes only local delivery jobs. It never drives acceptance or publication. */
export class ReleaseExportScheduler {
  readonly #stop = new AbortController();
  readonly #exporter: ReleaseExporter;
  readonly #options: Required<ReleaseExportSchedulerOptions>;
  #loop: Promise<void> | undefined;
  #pass: Promise<void> | undefined;
  lastError: string | null = null;

  constructor(readonly content: LocalContentStore, sources: ReleaseExportSources, options: ReleaseExportSchedulerOptions = {}) {
    const limit = (value: number | undefined, fallback: number, min: number, max: number) => {
      const n = value ?? fallback;
      if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error('Invalid release export scheduler limits');
      return n;
    };
    this.#options = {
      pollIntervalMs: limit(options.pollIntervalMs, 1000, 100, 60000),
      maxConcurrentJobs: limit(options.maxConcurrentJobs, 2, 1, 2),
      maxJobsPerPass: limit(options.maxJobsPerPass, 32, 1, 200),
    };
    this.#exporter = new ReleaseExporter(content, sources);
  }

  /** Coalesced, bounded full scan. Every pass starts at the original queue head. */
  tick(): Promise<void> {
    if (this.#stop.signal.aborted) return Promise.resolve();
    return this.#pass ??= this.consume().finally(() => { this.#pass = undefined; });
  }

  private async consume(): Promise<void> {
    let cursor: string | undefined;
    let remaining = this.#options.maxJobsPerPass;
    while (remaining > 0 && !this.#stop.signal.aborted) {
      const page = await this.content.storage.request('listReleaseExportWork', {
        ...(cursor ? {afterExportId: cursor} : {}), limit: Math.min(remaining, this.#options.maxConcurrentJobs),
      });
      await Promise.all(page.jobs.map(job => this.advance(job)));
      remaining -= page.jobs.length;
      if (!page.nextCursor || page.jobs.length === 0) return;
      cursor = page.nextCursor;
    }
  }

  private async advance(job: Results['listReleaseExportWork']['jobs'][number]): Promise<void> {
    if (this.#stop.signal.aborted) return;
    const subject = {principalId: job.principalId, exportId: job.exportId};
    try {
      if (job.state === 'PACKING') {
        await this.content.storage.request('retryReleaseExport', {...subject, expectedGeneration: job.generation});
      }
      if (this.#stop.signal.aborted) return;
      const signal = AbortSignal.any([this.#stop.signal, AbortSignal.timeout(90000)]);
      const result = await this.#exporter.advance(job.principalId, job.exportId, signal);
      if (result.state === 'FAILED') this.lastError = result.errorCode;
    } catch (error) {
      // Do not expose error text, paths, material bytes or private claim tokens.
      const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : '';
      this.lastError = /^[A-Z][A-Z0-9_]{0,95}$/.test(code) ? code : 'EXPORT_RECOVERY_UNAVAILABLE';
    }
  }

  start(): void {
    if (this.#loop || this.#stop.signal.aborted) throw new Error('Release export scheduler can only start once');
    this.#loop = (async () => {
      while (!this.#stop.signal.aborted) {
        try { await this.tick(); } catch { this.lastError = 'EXPORT_SCAN_UNAVAILABLE'; }
        try { await delay(this.#options.pollIntervalMs, undefined, {signal: this.#stop.signal}); } catch { break; }
      }
    })();
  }

  async stop(): Promise<void> {
    this.#stop.abort();
    await Promise.all([this.#loop, this.#pass]);
  }
}
