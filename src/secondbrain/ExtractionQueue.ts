export interface ExtractionQueueOptions {
  isBusy: () => boolean;
  /** Run extraction for a conversation; resolves the number of facts applied. */
  extract: (conversationId: string) => Promise<number>;
  pollMs?: number;
}

/**
 * Reliable Second Brain extraction. Conversations are marked dirty after each
 * reply; the queue drains them only when the shared llama context is idle, so an
 * extraction is never aborted mid-JSON by the next chat send. A failed/preempted
 * run leaves the conversation dirty for the next idle tick.
 */
export class ExtractionQueue {
  private dirty = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private draining = false;
  private readonly opts: Required<ExtractionQueueOptions>;

  constructor(opts: ExtractionQueueOptions) {
    this.opts = { pollMs: 1500, ...opts };
  }

  markDirty(conversationId: string): void {
    this.dirty.add(conversationId);
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
      const id = this.dirty.values().next().value as string;
      // Remove before running; re-add on failure so it retries next tick.
      this.dirty.delete(id);
      try {
        await this.opts.extract(id);
      } catch {
        this.dirty.add(id);
      }
    } finally {
      this.draining = false;
      if (this.dirty.size === 0) this.stop();
    }
  }
}
