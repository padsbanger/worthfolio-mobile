import { PortfolioRefresh, portfolioRefreshMs } from '../api/portfolio-refresh';
import { sampleBootstrap } from '../fixtures/portfolio';
import { ApiError } from '../api/client';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
function setup() {
  const bootstrap = jest.fn().mockResolvedValue(sampleBootstrap);
  const market = jest.fn().mockResolvedValue({});
  const cancel = jest.fn();
  return { bootstrap, market, cancel, refresh: new PortfolioRefresh({ bootstrap, market, cancel }) };
}

test('refreshes the union of holdings and the visible list, then reloads server totals every 90 seconds', async () => {
  const { refresh, bootstrap, market } = setup();
  refresh.setWatchSymbols(['NASDAQ:AAPL', 'BTC-USD', 'BTC-USD']);
  refresh.setEnabled(true);
  await refresh.refresh();
  expect(market.mock.calls.map(([symbol]) => symbol)).toEqual(['NASDAQ:AAPL', 'NASDAQ:MSFT', 'NYSE:VTI', 'BTC-USD']);
  expect(bootstrap.mock.calls).toEqual([[false], [true]]);
  expect(bootstrap.mock.invocationCallOrder[1]).toBeGreaterThan(market.mock.invocationCallOrder.at(-1)!);
  await jest.advanceTimersByTimeAsync(portfolioRefreshMs - 1);
  expect(market).toHaveBeenCalledTimes(4);
  await jest.advanceTimersByTimeAsync(1);
  expect(market).toHaveBeenCalledTimes(8);
  expect(refresh.getSnapshot()).toMatchObject({ refreshing: false, error: null });
  refresh.setEnabled(false);
});

test('overlapping manual and scheduled refreshes share the running round', async () => {
  const { refresh, bootstrap, market } = setup();
  const complete: (() => void)[] = [];
  market.mockImplementation(() => new Promise<void>(resolve => { complete.push(resolve); }));
  refresh.setEnabled(true);
  const first = refresh.refresh();
  await jest.advanceTimersByTimeAsync(0);
  expect(refresh.refresh()).toBe(first);
  await jest.advanceTimersByTimeAsync(portfolioRefreshMs * 3);
  expect(market).toHaveBeenCalledTimes(3);
  expect(bootstrap).toHaveBeenCalledTimes(1);
  complete.forEach(finish => finish());
  await first;
  expect(bootstrap).toHaveBeenCalledTimes(2);
  refresh.setEnabled(false);
});

test('pausing cancels work and timers; stale completions cannot restart or change the refresh state', async () => {
  const { refresh, bootstrap, market, cancel } = setup();
  const complete: (() => void)[] = [];
  market.mockImplementation(() => new Promise<void>(resolve => { complete.push(resolve); }));
  refresh.setEnabled(true);
  const pending = refresh.refresh();
  await jest.advanceTimersByTimeAsync(0);
  refresh.setEnabled(false);
  expect(cancel).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(portfolioRefreshMs * 3);
  await refresh.refresh();
  expect(market).toHaveBeenCalledTimes(3);
  complete.forEach(finish => finish());
  await pending;
  expect(bootstrap).toHaveBeenCalledTimes(1);
  expect(refresh.getSnapshot()).toEqual({ refreshing: false, error: null, completedAt: null });
  market.mockResolvedValue({});
  refresh.setEnabled(true);
  await refresh.refresh();
  expect(market).toHaveBeenCalledTimes(6);
  expect(refresh.getSnapshot().completedAt).not.toBeNull();
  refresh.setEnabled(false);
});

test('failed quotes still allow a server summary reload and show a partial-refresh warning', async () => {
  const { refresh, bootstrap, market } = setup();
  market.mockRejectedValueOnce(new Error('provider unavailable'));
  refresh.setEnabled(true);
  await refresh.refresh();
  expect(bootstrap.mock.calls).toEqual([[false], [true]]);
  expect(refresh.getSnapshot().error).toContain('Some quotes could not refresh');
  refresh.setEnabled(false);
});

test('a list chosen while bootstrap is loading is included without a redundant follow-up', async () => {
  const { refresh, bootstrap, market } = setup();
  let finish!: (value: typeof sampleBootstrap) => void;
  bootstrap.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  refresh.setEnabled(true);
  const pending = refresh.refresh();
  refresh.setWatchSymbols(['BTC-USD']);
  finish(sampleBootstrap);
  await pending;
  await jest.advanceTimersByTimeAsync(0);
  expect(market).toHaveBeenCalledTimes(4);
  refresh.setEnabled(false);
});

test('empty holdings still get a forced bootstrap on manual refresh without fake market requests', async () => {
  const { refresh, bootstrap, market } = setup();
  bootstrap.mockResolvedValue({ ...sampleBootstrap, positions: [] });
  refresh.setEnabled(true);
  await refresh.refresh();
  await refresh.refresh();
  expect(bootstrap.mock.calls).toEqual([[false], [true]]);
  expect(market).not.toHaveBeenCalled();
  refresh.setEnabled(false);
});

test('a degraded bootstrap uses known holdings to refresh quotes and recover server totals', async () => {
  const bootstrap = jest.fn().mockRejectedValueOnce(new ApiError('Degraded quotes', 422)).mockResolvedValue(sampleBootstrap);
  const market = jest.fn().mockResolvedValue({});
  const refresh = new PortfolioRefresh({ bootstrap, market, cancel: jest.fn(), cachedBootstrap: () => sampleBootstrap });
  refresh.setEnabled(true);
  await refresh.refresh();
  expect(market).toHaveBeenCalledTimes(3);
  expect(bootstrap).toHaveBeenCalledTimes(2);
  expect(refresh.getSnapshot().error).toBeNull();
  refresh.setEnabled(false);
});

test.each([401, 403])('cached holdings cannot continue a round after auth denial %s', async status => {
  const bootstrap = jest.fn().mockRejectedValue(new ApiError('Access denied', status));
  const market = jest.fn();
  const refresh = new PortfolioRefresh({ bootstrap, market, cancel: jest.fn(), cachedBootstrap: () => sampleBootstrap });
  refresh.setEnabled(true);
  await refresh.refresh();
  expect(market).not.toHaveBeenCalled();
  expect(refresh.getSnapshot().error).toBe('Access denied');
  refresh.setEnabled(false);
});
