import type { Bootstrap } from './contracts';
import { ApiError } from './client';

export const portfolioRefreshMs = 90_000;
type RefreshState = { refreshing: boolean; error: string | null; completedAt: number | null };
type Dependencies = {
  bootstrap(force: boolean): Promise<Bootstrap>;
  market(symbol: string, force: boolean): Promise<unknown>;
  cancel(): void;
  cachedBootstrap?(): Bootstrap | undefined;
};

/** Session-owned polling, shared by manual refresh, holdings, and the visible list. */
export class PortfolioRefresh {
  private enabled = false;
  private generation = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private watchSymbols: string[] = [];
  private followUp = false;
  private running: { generation: number; promise: Promise<void>; symbols?: Set<string> } | undefined;
  private state: RefreshState = { refreshing: false, error: null, completedAt: null };
  private listeners = new Set<() => void>();

  constructor(private readonly dependencies: Dependencies) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(values: Partial<RefreshState>) {
    this.state = { ...this.state, ...values };
    this.listeners.forEach(listener => listener());
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.generation++;
    clearInterval(this.timer);
    this.followUp = false;
    if (!enabled) {
      this.dependencies.cancel();
      this.update({ refreshing: false });
      return;
    }
    this.timer = setInterval(() => { void this.refresh(); }, portfolioRefreshMs);
    void this.refresh(false);
  }

  setWatchSymbols(symbols: string[]) {
    const next = [...new Set(symbols)].sort();
    if (JSON.stringify(next) === JSON.stringify(this.watchSymbols)) return;
    this.watchSymbols = next;
    if (this.enabled && next.length) {
      if (this.running?.generation === this.generation) {
        if (this.running.symbols && next.some(symbol => !this.running!.symbols!.has(symbol))) this.followUp = true;
      }
      else void this.refresh(false);
    }
  }

  refresh = (force = true): Promise<void> => {
    if (!this.enabled) return Promise.resolve();
    if (this.running?.generation === this.generation) return this.running.promise;
    const generation = this.generation;
    const current = () => this.enabled && generation === this.generation;
    this.update({ refreshing: true, error: null });
    const promise = (async () => {
      try {
        let bootstrap: Bootstrap;
        let initialError: unknown;
        try { bootstrap = await this.dependencies.bootstrap(force); }
        catch (error) {
          const cached = this.dependencies.cachedBootstrap?.();
          // A degraded bootstrap must not prevent quotes from repairing its cache.
          // Authentication failures still stop the round immediately.
          if (!cached || !(error instanceof ApiError) || ![0, 422].includes(error.status) && error.status < 500) throw error;
          bootstrap = cached; initialError = error;
        }
        if (!current()) return;
        const holdings = bootstrap.positions.map(position => position.symbol);
        const symbols = [...new Set([...holdings, ...this.watchSymbols])];
        if (this.running?.generation === generation) this.running.symbols = new Set(symbols);
        const results = await Promise.allSettled(symbols.map(symbol => this.dependencies.market(symbol, force)));
        if (!current()) return;
        if (holdings.length) await this.dependencies.bootstrap(true);
        else if (initialError) throw initialError;
        if (!current()) return;
        this.update({ completedAt: Date.now(), error: results.some(result => result.status === 'rejected')
          ? 'Some quotes could not refresh. Showing last-known data where available.' : null });
      } catch (error) {
        if (current()) this.update({ error: error instanceof Error ? error.message : 'Could not refresh your portfolio. Try again.' });
      } finally {
        if (current()) {
          this.running = undefined;
          this.update({ refreshing: false });
          if (this.followUp) { this.followUp = false; void this.refresh(false); }
        }
      }
    })();
    this.running = { generation, promise };
    return promise;
  };
}
