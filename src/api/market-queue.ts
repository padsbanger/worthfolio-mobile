type Subscriber = { resolve(value: unknown): void; reject(reason: Error): void; detach(): void };
type Job = { key: string; controller: AbortController;
  run(signal: AbortSignal): Promise<unknown>; subscribers: Set<Subscriber> };

/** One transport per key; callers cancel independently and share three slots. */
export class MarketQueue {
  private running = 0;
  private pending: Job[] = [];
  private jobs = new Map<string, Job>();

  request<T>(key: string, signal: AbortSignal, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (signal.aborted) return Promise.reject(new Error('Request cancelled.'));
    let job = this.jobs.get(key);
    if (!job) {
      job = { key, controller: new AbortController(), run, subscribers: new Set() };
      this.jobs.set(key, job);
      this.pending.push(job);
    }
    const shared = job;
    const promise = new Promise<T>((resolve, reject) => {
      const abort = () => {
        subscriber.detach(); shared.subscribers.delete(subscriber);
        reject(new Error('Request cancelled.'));
        if (!shared.subscribers.size) {
          shared.controller.abort();
          this.pending = this.pending.filter(item => item !== shared);
          if (this.jobs.get(key) === shared) this.jobs.delete(key);
        }
      };
      const subscriber: Subscriber = { resolve: value => resolve(value as T), reject,
        detach: () => signal.removeEventListener('abort', abort) };
      shared.subscribers.add(subscriber);
      signal.addEventListener('abort', abort, { once: true });
    });
    this.drain();
    return promise;
  }

  private drain() {
    while (this.running < 3 && this.pending.length) {
      const job = this.pending.shift()!;
      if (job.controller.signal.aborted) continue;
      this.running++;
      const finish = (value: unknown, error?: Error) => {
        for (const subscriber of job.subscribers) {
          subscriber.detach();
          if (error) subscriber.reject(error); else subscriber.resolve(value);
        }
        job.subscribers.clear();
        if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
      };
      void Promise.resolve().then(() => {
        if (job.controller.signal.aborted) throw new Error('Request cancelled.');
        return job.run(job.controller.signal);
      }).then(value => finish(value), error => finish(undefined, error instanceof Error ? error : new Error('Request failed.')))
        .finally(() => { this.running--; this.drain(); });
    }
  }
}
