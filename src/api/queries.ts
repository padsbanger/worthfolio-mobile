import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { ApiClient, ApiError } from './client';
import { bootstrapSchema, marketSchema, watchlistsSchema, type Bootstrap, type ChartRange, type Market } from './contracts';
import { MarketQueue } from './market-queue';

export function isSyntheticSource(source: string | undefined) {
  return !!source && /demo|synthetic|fixture/i.test(source);
}

/** Preserve the previous complete snapshot instead of mixing new totals with old quotes. */
export function validateBootstrap(next: Bootstrap, previous?: Bootstrap) {
  for (const position of next.positions) {
    const old = previous?.positions.find(item => item.symbol === position.symbol);
    const invalid = position.lastPrice != null && position.lastPrice <= 0;
    const lostPrice = old?.lastPrice != null && old.lastPrice > 0 && position.lastPrice == null;
    const older = !!old?.quoteRefreshedAt && !!position.quoteRefreshedAt && Date.parse(position.quoteRefreshedAt) < Date.parse(old.quoteRefreshedAt);
    if (invalid || lostPrice || older || isSyntheticSource(position.quoteSource) || position.stale === true) {
      throw new ApiError('Updated portfolio quotes are unavailable. Keeping the last portfolio snapshot, if available.', 422);
    }
  }
  return next;
}

export function createDataQueries(client: ApiClient, queue: MarketQueue, cache: QueryClient) {
  return {
    bootstrap: queryOptions({ queryKey: ['bootstrap'], queryFn: async ({ signal }) => {
      const next = await client.request('/api/bootstrap', bootstrapSchema, { signal });
      return validateBootstrap(next, cache.getQueryData<Bootstrap>(['bootstrap']));
    } }),
    watchlists: queryOptions({ queryKey: ['watchlists'], queryFn: ({ signal }) =>
      client.request('/api/watchlists', watchlistsSchema, { signal }) }),
    market: (symbol: string, range: ChartRange) => queryOptions({ queryKey: ['market', symbol, range],
      queryFn: ({ signal }) => queue.request(`${symbol}:${range}`, signal, async sharedSignal => {
        const query = new URLSearchParams({ symbol, range, refresh: '1' });
        const market = await client.request(`/api/market?${query}`, marketSchema, { signal: sharedSignal });
        const previous = cache.getQueryData<Market>(['market', symbol, range]);
        const older = !!previous?.refreshedAt && !!market.refreshedAt && Date.parse(market.refreshedAt) < Date.parse(previous.refreshedAt);
        if (older || market.symbol !== symbol || isSyntheticSource(market.source) || market.lastPrice == null || market.lastPrice <= 0 || market.stale) {
          throw new ApiError('Current market data is unavailable. Keeping the last real observation, if available.', 422);
        }
        return market;
      }),
    }),
  };
}
