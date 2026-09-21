import { AppState, Keyboard, Text, type AppStateStatus } from 'react-native';
import { useEffect, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { DataProvider, selectedRefreshMs, useData, useListMarkets, useMarket } from '../api/data';
import { SearchScreen } from '../features/SearchScreen';
import { InstrumentScreen } from '../features/InstrumentScreen';
import { sampleBootstrap, sampleMarket, sampleSearch } from '../fixtures/portfolio';

type Network = { isConnected: boolean; isInternetReachable: boolean };
let mockNetwork: (state: Network) => void;
let appChange: (state: AppStateStatus) => void;
let mockFocused = true;
let mockSymbol = 'NASDAQ:AAPL';
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused,
  useLocalSearchParams: () => ({ symbol: mockSymbol }), Stack: { Screen: ({ options }: { options: { headerRight?: () => ReactNode } }) => options.headerRight?.() ?? null }, router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../lib/config', () => ({ server: { url: 'https://worthfolio.test' } }));
jest.mock('../auth/session', () => ({ useSession: () => ({ session: { id: 1, demo: false,
  credential: { accessToken: 'test-token' } }, expire: jest.fn() }) }));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: (listener: typeof mockNetwork) => {
  mockNetwork = listener;
  listener({ isConnected: true, isInternetReachable: true });
  return () => {};
} }));

const originalFetch = global.fetch;
const originalAppState = AppState.currentState;
const bootstrap = { ...sampleBootstrap, positions: [], marketData: { selectedRefreshSeconds: 7 } };
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const quote = (symbol = 'NASDAQ:AAPL') => ({ ...sampleMarket(symbol), source: 'Test provider' });
let fetcher: jest.Mock;
const tick = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
const connect = (connected: boolean) => act(() => mockNetwork({ isConnected: connected, isInternetReachable: connected }));
beforeEach(() => {
  jest.useFakeTimers(); mockFocused = true; mockSymbol = 'NASDAQ:AAPL';
  AppState.currentState = 'active'; onlineManager.setOnline(true);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appChange = listener; return { remove: jest.fn() };
  });
  fetcher = jest.fn().mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? bootstrap : quote()));
  global.fetch = fetcher;
});
afterEach(() => {
  global.fetch = originalFetch; AppState.currentState = originalAppState;
  jest.restoreAllMocks(); onlineManager.setOnline(true); jest.useRealTimers();
});

test('search debounces, immediately aborts superseded input and ignores a late response before navigation', async () => {
  const pending: { query: string; signal: AbortSignal; finish: () => void }[] = [];
  fetcher.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith('/api/bootstrap')) return Promise.resolve(response(bootstrap));
    const query = new URL(url).searchParams.get('q')!;
    return new Promise(resolve => pending.push({ query, signal: options.signal!, finish: () => resolve(response(sampleSearch(query))) }));
  });
  render(<DataProvider><SearchScreen /></DataProvider>);
  fireEvent.changeText(screen.getByLabelText('Search instruments'), ' A ');
  await tick(300); expect(pending).toHaveLength(0);
  fireEvent.changeText(screen.getByLabelText('Search instruments'), 'Apple');
  await tick(299); expect(pending).toHaveLength(0);
  await tick(2); expect(pending[0]?.query).toBe('Apple');
  fireEvent.changeText(screen.getByLabelText('Search instruments'), 'Microsoft');
  expect(pending[0]?.signal.aborted).toBe(true);
  await tick(301); expect(pending[1]?.query).toBe('Microsoft');
  await act(async () => { pending[1]!.finish(); pending[0]!.finish(); });
  expect(await screen.findByLabelText('Open Microsoft')).toBeTruthy();
  expect(screen.queryByLabelText('Open Apple')).toBeNull();
  fireEvent.press(screen.getByLabelText('Open Microsoft'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/instrument', params: { symbol: 'NASDAQ:MSFT' } });
});

test('search shows offline, empty, error and retry recovery without mistaking disabled queries for empty results', async () => {
  fetcher.mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? bootstrap : { results: [] }));
  render(<DataProvider><SearchScreen /></DataProvider>);
  connect(false);
  fireEvent.changeText(screen.getByLabelText('Search instruments'), 'unknown');
  await tick(301);
  expect(screen.getByText('Connect to search')).toBeTruthy();
  expect(fetcher.mock.calls.filter(([url]) => url.includes('/api/search'))).toHaveLength(0);
  connect(true); expect(await screen.findByText('No instruments found')).toBeTruthy();
  fetcher.mockImplementation(async (url: string) => url.endsWith('/api/bootstrap') ? response(bootstrap) : { ok: false, status: 403 });
  fireEvent.changeText(screen.getByLabelText('Search instruments'), 'Apple');
  await tick(301); expect(await screen.findByText('Search unavailable')).toBeTruthy();
  fetcher.mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? bootstrap : sampleSearch('Apple')));
  fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByLabelText('Open Apple')).toBeTruthy();
});

function MarketProbe({ range = '1M', seconds = 7 }: { range?: '1M' | '1D'; seconds?: number }) {
  const result = useMarket('NASDAQ:AAPL', range, seconds);
  return <Text>{result.data?.name ?? 'Waiting'}</Text>;
}

test('clearing search immediately aborts pending work and ignores late results', async () => {
  let finish!: () => void;
  let signal!: AbortSignal;
  fetcher.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith('/api/bootstrap')) return Promise.resolve(response(bootstrap));
    signal = options.signal!;
    return new Promise(resolve => { finish = () => resolve(response(sampleSearch('Apple'))); });
  });
  render(<DataProvider><SearchScreen /></DataProvider>);
  fireEvent.changeText(screen.getByLabelText('Search instruments'), 'Apple');
  await tick(301);
  fireEvent.press(screen.getByLabelText('Clear search'));
  expect(signal.aborted).toBe(true);
  expect(screen.getByLabelText('Search instruments').props.value).toBe('');
  await act(async () => finish());
  await tick(301);
  expect(screen.queryByLabelText('Open Apple')).toBeNull();
  expect(screen.getByText('Find an instrument')).toBeTruthy();
  expect(fetcher.mock.calls.filter(([url]) => url.includes('/api/search'))).toHaveLength(1);
});

test('cached search results survive a failed refresh and recover with compact retry', async () => {
  let refetch!: () => Promise<void>;
  function SearchProbe() {
    const { queryClient } = useData();
    useEffect(() => { refetch = () => queryClient.refetchQueries({ queryKey: ['search', 'Apple'] }); }, [queryClient]);
    return <SearchScreen />;
  }
  fetcher.mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? bootstrap : sampleSearch('Apple')));
  render(<DataProvider><SearchProbe /></DataProvider>);
  fireEvent.changeText(screen.getByLabelText('Search instruments'), 'Apple');
  await tick(301);
  expect(await screen.findByLabelText('Open Apple')).toBeTruthy();
  fetcher.mockImplementation(async (url: string) => url.endsWith('/api/bootstrap') ? response(bootstrap) : { ok: false, status: 403 });
  await act(async () => refetch());
  expect(await screen.findByText('Updates delayed')).toBeTruthy();
  expect(screen.getByLabelText('Open Apple')).toBeTruthy();
  expect(screen.queryByText('Search unavailable')).toBeNull();
  fetcher.mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? bootstrap : sampleSearch('Apple')));
  fireEvent.press(screen.getByLabelText('Retry refresh'));
  await waitFor(() => expect(screen.queryByText('Updates delayed')).toBeNull());
  expect(screen.getByLabelText('Open Apple')).toBeTruthy();
});

test('submit and opening a result dismiss the keyboard without a new search request', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  fetcher.mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? bootstrap : sampleSearch('Apple')));
  render(<DataProvider><SearchScreen /></DataProvider>);
  fireEvent.changeText(screen.getByLabelText('Search instruments'), 'Apple');
  await tick(301);
  expect(await screen.findByLabelText('Open Apple')).toBeTruthy();
  fireEvent(screen.getByLabelText('Search instruments'), 'submitEditing');
  expect(dismiss).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Open Apple'));
  expect(dismiss).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.filter(([url]) => url.includes('/api/search'))).toHaveLength(1);
});

test('instrument cadence follows backend settings; blur, background and offline stop polling and cancel requests', async () => {
  const view = render(<DataProvider><InstrumentScreen /></DataProvider>);
  expect(await screen.findByText('Apple')).toBeTruthy();
  const count = () => fetcher.mock.calls.filter(([url]) => url.includes('/api/market')).length;
  expect(count()).toBe(1);
  await tick(6_900); expect(count()).toBe(1);
  await tick(200); expect(count()).toBe(2);
  mockFocused = false; view.rerender(<DataProvider><InstrumentScreen /></DataProvider>);
  await tick(22_000); expect(count()).toBe(2);
  mockFocused = true; view.rerender(<DataProvider><InstrumentScreen /></DataProvider>);
  await waitFor(() => expect(count()).toBe(3));
  act(() => appChange('background')); await tick(22_000); expect(count()).toBe(3);
  act(() => appChange('active')); await waitFor(() => expect(count()).toBe(4));
  connect(false); await tick(22_000); expect(count()).toBe(4);
  connect(true); await waitFor(() => expect(count()).toBe(5));
  let signal: AbortSignal | undefined;
  fetcher.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith('/api/bootstrap')) return Promise.resolve(response(bootstrap));
    signal = options.signal!; return new Promise(() => {});
  });
  await tick(7_100); expect(signal?.aborted).toBe(false);
  mockFocused = false; view.rerender(<DataProvider><InstrumentScreen /></DataProvider>);
  expect(signal?.aborted).toBe(true);
});

test('slow chart requests do not overlap interval ticks and range changes abort only the superseded request', async () => {
  const pending: { signal: AbortSignal; finish: () => void }[] = [];
  fetcher.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith('/api/bootstrap')) return Promise.resolve(response(bootstrap));
    return new Promise(resolve => pending.push({ signal: options.signal!, finish: () => resolve(response(quote())) }));
  });
  const view = render(<DataProvider><MarketProbe /></DataProvider>);
  await waitFor(() => expect(pending).toHaveLength(1));
  await tick(21_000); expect(pending).toHaveLength(1);
  view.rerender(<DataProvider><MarketProbe range="1D" /></DataProvider>);
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(pending[0]?.signal.aborted).toBe(true);
  expect(pending[1]?.signal.aborted).toBe(false);
  await act(async () => pending[0]!.finish());
  expect(screen.getByText('Waiting')).toBeTruthy();
  await act(async () => pending[1]!.finish());
  expect(await screen.findByText('Apple')).toBeTruthy();
});

test('instrument defaults/reset to 1M, renders holding and daily change, and rejects synthetic history', async () => {
  const holding = { ...sampleBootstrap.positions[0]!, quoteSource: 'Test provider' };
  fetcher.mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? { ...bootstrap, positions: [holding] } : quote(new URL(url).searchParams.get('symbol')!)));
  const view = render(<DataProvider><InstrumentScreen /></DataProvider>);
  expect(await screen.findByText('Your position')).toBeTruthy();
  expect(await screen.findByText('+1.20% daily change')).toBeTruthy();
  expect(screen.getByText('$4,200.00')).toBeTruthy();
  expect(screen.getByLabelText('1M price history')).toBeSelected();
  fireEvent.press(screen.getByLabelText('ALL price history'));
  expect(await screen.findByText(/Available provider history/)).toBeTruthy();
  fetcher.mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? bootstrap : sampleMarket('NASDAQ:MSFT')));
  mockSymbol = 'NASDAQ:MSFT'; view.rerender(<DataProvider><InstrumentScreen /></DataProvider>);
  expect(screen.getByLabelText('1M price history')).toBeSelected();
  expect(await screen.findByText('Price history unavailable')).toBeTruthy();
  expect(screen.queryByLabelText('Price history')).toBeNull();
});

test('instrument adds and removes membership while preserving other instruments', async () => {
  const target = sampleBootstrap.watchlists[1]!;
  fetcher.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith('/api/bootstrap')) return response(bootstrap);
    if (url.includes(`/api/watchlists/${target.id}`)) return response({ watchlist: { ...target, ...JSON.parse(options.body as string) } });
    return response(quote());
  });
  render(<DataProvider><InstrumentScreen /></DataProvider>);
  expect(await screen.findByText('Apple')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Manage watchlists'));
  fireEvent.press(screen.getByLabelText('Add to On my radar'));
  expect(await screen.findByText('Added to On my radar.')).toBeTruthy();
  expect(screen.getByLabelText('Remove from On my radar')).toBeEnabled();
  fireEvent.press(screen.getByLabelText('Remove from On my radar'));
  expect(await screen.findByText('Removed from On my radar.')).toBeTruthy();
  expect(screen.getByLabelText('Add to On my radar')).toBeEnabled();
  const writes = fetcher.mock.calls.filter(([url]) => url.includes(`/api/watchlists/${target.id}`));
  expect(writes).toHaveLength(2);
  expect(writes[1]?.[1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ symbols: target.symbols }) });
  fireEvent.press(screen.getByLabelText('Close watchlist chooser'));
  expect(screen.queryByLabelText('Add to On my radar')).toBeNull();
  const update = fetcher.mock.calls.find(([url]) => url.includes(`/api/watchlists/${target.id}`));
  expect(update?.[1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ symbols: [...target.symbols, 'NASDAQ:AAPL'] }) });
});

test('watchlist sheet explains offline state and prevents adding after losing connection', async () => {
  render(<DataProvider><InstrumentScreen /></DataProvider>);
  expect(await screen.findByText('Apple')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Manage watchlists'));
  connect(false);
  expect(screen.getByText('Connect to edit watchlists.')).toBeTruthy();
  expect(screen.getByLabelText('Remove from Core holdings')).toBeDisabled();
  expect(screen.getByLabelText('Add to On my radar')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Add to On my radar'));
  expect(fetcher.mock.calls.some(([, options]) => options.method === 'PUT')).toBe(false);
  fireEvent.press(screen.getByLabelText('Close watchlist chooser'));
  expect(screen.queryByText('Connect to edit watchlists.')).toBeNull();
});

test('failed removal keeps membership and allows an explicit retry, including an empty list', async () => {
  const target = { ...sampleBootstrap.watchlists[0]!, symbols: ['NASDAQ:AAPL'] };
  let fail = true;
  fetcher.mockImplementation(async (url: string) => {
    if (url.endsWith('/api/bootstrap')) return response({ ...bootstrap, watchlists: [target] });
    if (url.includes(`/api/watchlists/${target.id}`)) return fail
      ? { ok: false, status: 503 }
      : response({ watchlist: { ...target, symbols: [] } });
    return response(quote());
  });
  render(<DataProvider><InstrumentScreen /></DataProvider>);
  expect(await screen.findByText('Apple')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Manage watchlists'));
  fireEvent.press(screen.getByLabelText('Remove from Core holdings'));
  expect(await screen.findByText(/Tap a list to try again/)).toBeTruthy();
  expect(screen.getByLabelText('Remove from Core holdings')).toBeEnabled();
  expect(fetcher.mock.calls.filter(([, options]) => options.method === 'PUT')).toHaveLength(1);
  fail = false;
  fireEvent.press(screen.getByLabelText('Remove from Core holdings'));
  expect(await screen.findByText('Removed from Core holdings.')).toBeTruthy();
  expect(screen.getByLabelText('Add to Core holdings')).toBeEnabled();
  const writes = fetcher.mock.calls.filter(([, options]) => options.method === 'PUT');
  expect(writes[1]?.[1].body).toBe(JSON.stringify({ symbols: [] }));
});

test('cadence defaults safely when absent/invalid and cannot create a busy timer', () => {
  expect(selectedRefreshMs()).toBe(5_000);
  expect(selectedRefreshMs(7)).toBe(7_000);
  for (const value of [0, -1, NaN, Infinity]) expect(selectedRefreshMs(value)).toBe(5_000);
  expect(selectedRefreshMs(0.01)).toBe(1_000);
});


test('instrument keeps quote flags visible and reveals provenance without another request; failed updates retain history', async () => {
  fetcher.mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? bootstrap : { ...quote(), cached: true, delayed: true }));
  render(<DataProvider><InstrumentScreen /></DataProvider>);
  expect(await screen.findByText('Provider delayed \u00b7 Cached')).toBeTruthy();
  expect(screen.queryByText('Source: Test provider')).toBeNull();
  const count = fetcher.mock.calls.length;
  fireEvent.press(screen.getByLabelText('Quote details'));
  expect(screen.getByText('Source: Test provider')).toBeTruthy();
  expect(screen.getByText(`Fetched: ${quote().refreshedAt}`)).toBeTruthy();
  expect(fetcher.mock.calls).toHaveLength(count);
  fetcher.mockImplementation(async (url: string) => url.endsWith('/api/bootstrap') ? response(bootstrap) : { ok: false, status: 403 });
  await tick(7100);
  expect(await screen.findByText('Updates delayed')).toBeTruthy();
  expect(screen.getByLabelText('Price history')).toBeTruthy();
  expect(screen.getByText('Apple')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Quote details'));
  expect(screen.queryByText('Source: Test provider')).toBeNull();
  expect(screen.getByText('Provider delayed \u00b7 Cached')).toBeTruthy();
});

test.each([['GBX', 1.25, '-$50.00', '+$5.00'], ['EUR', null, 'Unavailable', 'Unavailable']] as const)(
  'position metrics preserve short signs, GBX conversion and missing FX for %s', async (currency, baseRate, value, pnl) => {
    const holding = { ...sampleBootstrap.positions[0]!, quantity: -2, avgPrice: 2200, lastPrice: 2000, currency, baseRate, quoteSource: 'Test provider' };
    fetcher.mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? { ...bootstrap, positions: [holding] } : { ...quote(), currency, lastPrice: 2000 }));
    render(<DataProvider><InstrumentScreen /></DataProvider>);
    expect(await screen.findByText('-2 units \u00b7 Short')).toBeTruthy();
    expect(screen.getAllByText(value).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pnl).length).toBeGreaterThan(0);
  },
);

test('every range requests its own history and keeps the selected control identifiable', async () => {
  render(<DataProvider><InstrumentScreen /></DataProvider>);
  expect(await screen.findByText('Apple')).toBeTruthy();
  for (const range of ['1D', '5D', '6M', '1Y', 'ALL', '1M']) {
    fireEvent.press(screen.getByLabelText(`${range} price history`));
    expect(screen.getByLabelText(`${range} price history`)).toBeSelected();
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.includes('/api/market') && new URL(url).searchParams.get('range') === range)).toBe(true));
    expect(await screen.findByLabelText('Price history')).toBeTruthy();
  }
});


test('list ranking loads off-screen symbols through the shared queue and cancels history on period change and blur', async () => {
  const pending: { symbol: string; range: string; signal: AbortSignal; finish: () => void }[] = [];
  fetcher.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith('/api/bootstrap')) return Promise.resolve(response(bootstrap));
    const params = new URL(url).searchParams;
    const symbol = params.get('symbol')!;
    return new Promise(resolve => pending.push({ symbol, range: params.get('range')!, signal: options.signal!, finish: () => resolve(response(quote(symbol))) }));
  });
  function ListProbe({ range }: { range: '1D' | '1M' }) {
    const results = useListMarkets(['A', 'B', 'C', 'D', 'E'], range);
    return <Text>{[...results.values()].filter(r => r.data).length} loaded</Text>;
  }
  const view = render(<DataProvider><ListProbe range="1D" /></DataProvider>);
  await waitFor(() => expect(pending).toHaveLength(3));
  await act(async () => pending[0]!.finish());
  await waitFor(() => expect(pending).toHaveLength(4));
  await act(async () => pending[1]!.finish());
  await waitFor(() => expect(pending).toHaveLength(5));
  await act(async () => pending.slice(2).forEach(p => p.finish()));
  expect(await screen.findByText('5 loaded')).toBeTruthy();
  const count = pending.length;
  view.rerender(<DataProvider><ListProbe range="1D" /></DataProvider>);
  expect(pending).toHaveLength(count);
  view.rerender(<DataProvider><ListProbe range="1M" /></DataProvider>);
  await waitFor(() => expect(pending).toHaveLength(8));
  expect(screen.getByText('0 loaded')).toBeTruthy();
  mockFocused = false;
  view.rerender(<DataProvider><ListProbe range="1M" /></DataProvider>);
  expect(pending.slice(5).every(p => p.signal.aborted)).toBe(true);
  await tick(180_000);
  expect(pending).toHaveLength(8);
  await act(async () => pending.slice(5).forEach(p => p.finish()));
  view.rerender(<DataProvider><ListProbe range="1D" /></DataProvider>);
  expect(screen.getByText('5 loaded')).toBeTruthy();
});
