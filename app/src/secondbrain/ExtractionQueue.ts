export interface ExtractionQueueOptions {
  isBusy: () => boolean;
  /** Whether a newly completed conversation may be queued for extraction. */
  canQueue?: () => boolean;
  /** Changes whenever queueing consent is withdrawn or restored. */
  queueToken?: () => unknown;
  /** Run extraction for a conversation; resolves the number of facts applied. */
  extract: (conversationId: string, queueToken: unknown) => Promise<number>;
  /** Called after a successful drain with the number of facts learned/updated. */
  onResult?: (conversationId: string, count: number) => void;
  pollMs?: number;
}

/**
 * Reliable Second Brain extraction. Conversations are marked dirty after each
 * reply; the queue drains them only when the shared llama context is idle, so an
 * extraction is never aborted mid-JSON by the next chat send. A failed/preempted
 * run leaves the conversation dirty for the next idle tick.
 */
export class ExtractionQueue {
  private dirty = new Map<string, unknown>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private draining = false;
  private readonly opts: Required<ExtractionQueueOptions>;

  constructor(opts: ExtractionQueueOptions) {
    this.opts = {
      pollMs: 1500,
      onResult: () => {},
      canQueue: () => true,
      queueToken: () => true,
      ...opts,
    };
  }

  markDirty(conversationId: string): void {
    // Decide at reply time, not drain time. Otherwise a reply completed while
    // Core is off can wait behind a busy model and be extracted retroactively
    // if the user enables Core before the queue next becomes idle.
    if (!this.opts.canQueue()) return;
    this.dirty.set(conversationId, this.opts.queueToken());
    this.ensureTimer();
  }

  /** Force an immediate drain attempt (e.g. on app background / chat blur). */
  flush(): void { void this.drain(); }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private ensureTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.drain(); }, this.opts.pollMs);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    if (this.dirty.size === 0) { this.stop(); return; }
    if (this.opts.isBusy()) return;
    this.draining = true;
    try {
      const [id, queuedToken] = this.dirty.entries().next().value as [string, unknown];
      // Remove before running; re-add on failure so it retries next tick.
      this.dirty.delete(id);
      if (!this.opts.canQueue() || queuedToken !== this.opts.queueToken()) return;
      try {
        const count = await this.opts.extract(id, queuedToken);
        if (!this.opts.canQueue() || queuedToken !== this.opts.queueToken()) return;
        this.opts.onResult(id, count);
      } catch {
        // A newer reply for the same conversation may have been queued while
        // extraction was running. Never replace its current consent token with
        // the failed attempt's stale generation.
        if (
          !this.dirty.has(id) &&
          this.opts.canQueue() &&
          queuedToken === this.opts.queueToken()
        ) {
          this.dirty.set(id, queuedToken);
        }
      }
    } finally {
      this.draining = false;
      if (this.dirty.size === 0) this.stop();
    }
  }
}
