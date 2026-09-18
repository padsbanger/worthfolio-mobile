import { AppState, Text, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { DataProvider, selectedRefreshMs, useMarket } from '../api/data';
import { SearchScreen } from '../features/SearchScreen';
import { InstrumentScreen } from '../features/InstrumentScreen';
import { sampleBootstrap, sampleMarket, sampleSearch } from '../fixtures/portfolio';

type Network = { isConnected: boolean; isInternetReachable: boolean };
let mockNetwork: (state: Network) => void;
let appChange: (state: AppStateStatus) => void;
let mockFocused = true;
let mockSymbol = 'NASDAQ:AAPL';
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused,
  useLocalSearchParams: () => ({ symbol: mockSymbol }), Stack: { Screen: () => null }, router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
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
  expect(await screen.findByText('+1.20% today')).toBeTruthy();
  expect(screen.getByText('Value $4,200.00')).toBeTruthy();
  expect(screen.getByLabelText('1M price history')).toBeSelected();
  fireEvent.press(screen.getByLabelText('ALL price history'));
  expect(await screen.findByText(/Available provider history/)).toBeTruthy();
  fetcher.mockImplementation(async (url: string) => response(url.endsWith('/api/bootstrap') ? bootstrap : sampleMarket('NASDAQ:MSFT')));
  mockSymbol = 'NASDAQ:MSFT'; view.rerender(<DataProvider><InstrumentScreen /></DataProvider>);
  expect(screen.getByLabelText('1M price history')).toBeSelected();
  expect(await screen.findByText('Price history unavailable')).toBeTruthy();
  expect(screen.queryByLabelText('Price history')).toBeNull();
});

test('cadence defaults safely when absent/invalid and cannot create a busy timer', () => {
  expect(selectedRefreshMs()).toBe(5_000);
  expect(selectedRefreshMs(7)).toBe(7_000);
  for (const value of [0, -1, NaN, Infinity]) expect(selectedRefreshMs(value)).toBe(5_000);
  expect(selectedRefreshMs(0.01)).toBe(1_000);
});
