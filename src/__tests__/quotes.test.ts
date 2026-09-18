import { QueryClient } from '@tanstack/react-query';
import { ApiClient } from '../api/client';
import { createDataQueries } from '../api/queries';
import { MarketQueue } from '../api/market-queue';
import { sampleBootstrap, sampleMarket } from '../fixtures/portfolio';

const originalFetch = global.fetch;
const realMarket = () => ({ ...sampleMarket('NASDAQ:AAPL', '1D'), source: 'Test provider', refreshedAt: '2026-09-17T10:00:00Z' });
const realBootstrap = () => ({ ...sampleBootstrap, positions: sampleBootstrap.positions.map(p => ({ ...p, quoteSource: 'Test provider' })) });
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
let cache: QueryClient;
beforeEach(() => { cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); });
afterEach(() => { cache.clear(); global.fetch = originalFetch; });

test.each([
  { stale: true }, { source: 'Offline demo series' }, { source: 'Synthetic provider fallback' },
  { lastPrice: null }, { lastPrice: 0 }, { lastPrice: 'bad' }, { symbol: 'OTHER' }, { refreshedAt: '2025-01-01T00:00:00Z' },
])('rejects a bad quote without replacing the last real observation: %j', async change => {
  const fetcher = jest.fn().mockResolvedValueOnce(response(realMarket())).mockResolvedValue(response({ ...realMarket(), ...change }));
  global.fetch = fetcher;
  const queries = createDataQueries(new ApiClient('https://worthfolio.test', 'test'), new MarketQueue(), cache);
  const options = queries.market('NASDAQ:AAPL', '1D');
  const first = await cache.fetchQuery(options);
  await expect(cache.fetchQuery(options)).rejects.toThrow();
  expect(cache.getQueryData(options.queryKey)).toBe(first);
  expect(fetcher.mock.calls[0][0]).toContain('refresh=1');
  expect(fetcher.mock.calls[0][0]).toContain('events=1');
  expect(fetcher.mock.calls[0][0]).not.toContain('extended=1');
  expect(fetcher.mock.calls[0][1].method).toBe('GET');
});

test.each([
  { quoteSource: 'Offline demo series' }, { lastPrice: null }, { lastPrice: -1 }, { stale: true },
  { quoteRefreshedAt: '2025-01-01T00:00:00Z' },
])('keeps a complete authoritative snapshot when refreshed holdings regress: %j', async change => {
  const initial = realBootstrap();
  global.fetch = jest.fn().mockResolvedValueOnce(response(initial)).mockResolvedValue(response({ ...initial,
    positions: initial.positions.map((p, index) => index === 0 ? { ...p, ...change } : p),
    portfolioSummary: { ...initial.portfolioSummary, value: 999 },
  }));
  const queries = createDataQueries(new ApiClient('https://worthfolio.test'), new MarketQueue(), cache);
  const first = await cache.fetchQuery(queries.bootstrap);
  await expect(cache.fetchQuery(queries.bootstrap)).rejects.toThrow();
  expect(cache.getQueryData(['bootstrap'])).toBe(first);
  expect(first.portfolioSummary.value).toBe(initial.portfolioSummary.value);
});

test('a first partial portfolio is valid; totals stay server-owned and cash is not added', async () => {
  const initial = realBootstrap();
  const snapshot = { ...initial, cash: 100000, positions: initial.positions.map(p => ({ ...p, lastPrice: null, baseRate: null })),
    portfolioSummary: { ...initial.portfolioSummary, value: 0, coverage: 0, pricedPositions: 0 } };
  global.fetch = jest.fn().mockResolvedValue(response(snapshot));
  const queries = createDataQueries(new ApiClient('https://worthfolio.test'), new MarketQueue(), cache);
  const data = await cache.fetchQuery(queries.bootstrap);
  expect(data.portfolioSummary.value).toBe(0);
  expect(data.portfolioSummary.coverage).toBe(0);
  expect(data.positions[0]?.lastPrice).toBeNull();
});

test.each(['network', 'provider'])('a %s failure leaves the last real quote in memory', async failure => {
  const fetcher = jest.fn().mockResolvedValueOnce(response(realMarket()));
  global.fetch = fetcher;
  const queries = createDataQueries(new ApiClient('https://worthfolio.test'), new MarketQueue(), cache);
  const options = queries.market('NASDAQ:AAPL', '1D');
  const before = await cache.fetchQuery(options);
  if (failure === 'network') fetcher.mockRejectedValue(new Error('offline'));
  else fetcher.mockResolvedValue({ ok: false, status: 503 });
  await expect(cache.fetchQuery(options)).rejects.toThrow();
  expect(cache.getQueryData(options.queryKey)).toBe(before);
});

test('screen and refresher requests share cache work and all ranges share the concurrency limit', async () => {
  let active = 0;
  let peak = 0;
  const finish: (() => void)[] = [];
  const fetcher = jest.fn().mockImplementation((url: string) => new Promise(resolve => {
    peak = Math.max(peak, ++active);
    const symbol = new URL(url).searchParams.get('symbol');
    finish.push(() => { active--; resolve(response({ ...realMarket(), symbol })); });
  }));
  global.fetch = fetcher;
  const queries = createDataQueries(new ApiClient('https://worthfolio.test'), new MarketQueue(), cache);
  const options = queries.market('NASDAQ:AAPL', '1D');
  const first = cache.fetchQuery(options);
  const duplicate = cache.fetchQuery(options);
  const others = ['1M', '6M', '1Y'].map(range => cache.fetchQuery(queries.market('NASDAQ:AAPL', range as '1M' | '6M' | '1Y')));
  await Promise.resolve(); await Promise.resolve();
  expect(fetcher).toHaveBeenCalledTimes(3);
  finish.splice(0).forEach(done => done());
  await first;
  for (let i = 0; i < 10; i++) await Promise.resolve();
  finish.splice(0).forEach(done => done());
  await Promise.all([duplicate, ...others]);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(peak).toBe(3);
});
