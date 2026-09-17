/** A session-owned market queue: bounded work, duplicate coalescing, and cancellation. */
export class MarketQueue {
  private running = 0;
  private pending: (() => void)[] = [];
  private jobs = new Map<string, Promise<unknown>>();

  request<T>(key: string, signal: AbortSignal, run: () => Promise<T>): Promise<T> {
    if (signal.aborted) return Promise.reject(new Error('Request cancelled.'));
    const existing = this.jobs.get(key);
    if (existing) return existing as Promise<T>;
    const job = new Promise<T>((resolve, reject) => {
      let started = false;
      const abort = () => {
        if (!started) {
          this.pending = this.pending.filter(item => item !== start);
          reject(new Error('Request cancelled.'));
        }
      };
      const start = () => {
        signal.removeEventListener('abort', abort);
        if (signal.aborted) { reject(new Error('Request cancelled.')); return; }
        started = true;
        this.running++;
        Promise.resolve().then(run).then(resolve, reject).finally(() => {
          this.running--;
          this.drain();
        });
      };
      signal.addEventListener('abort', abort, { once: true });
      this.pending.push(start);
    });
    this.jobs.set(key, job);
    // Attach both handlers so cleanup never creates an unhandled rejection.
    const cleanup = () => { if (this.jobs.get(key) === job) this.jobs.delete(key); };
    void job.then(cleanup, cleanup);
    this.drain();
    return job;
  }

  private drain() {
    while (this.running < 3 && this.pending.length) this.pending.shift()!();
  }
}
