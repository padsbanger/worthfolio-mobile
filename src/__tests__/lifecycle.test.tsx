import { AppState, Text, type AppStateStatus } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { DataProvider, useBootstrap, useData, useMarket } from '../api/data';
import { sampleBootstrap, sampleMarket } from '../fixtures/portfolio';
import { portfolioRefreshMs } from '../api/portfolio-refresh';

type Network = { isConnected: boolean; isInternetReachable: boolean };
let mockNetwork: (state: Network) => void;
let appChange: (state: AppStateStatus) => void;
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('../lib/config', () => ({ server: { url: 'https://worthfolio.test' } }));
jest.mock('../auth/session', () => ({ useSession: () => ({ session: { id: 1, demo: false,
  credential: { accessToken: 'test-token' } }, expire: jest.fn() }) }));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: (listener: typeof mockNetwork) => {
  mockNetwork = listener;
  listener({ isConnected: false, isInternetReachable: false });
  return () => {};
} }));

const originalFetch = global.fetch;
const originalAppState = AppState.currentState;
const bootstrap = { ...sampleBootstrap, positions: sampleBootstrap.positions.map(p => ({ ...p, quoteSource: 'Test provider' })) };
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
let fetcher: jest.Mock;
function Probe() {
  const result = useBootstrap();
  const { online } = useData();
  return <Text>{result.data ? (online ? 'Live snapshot' : 'Offline saved snapshot') : 'Connect to load portfolio'}</Text>;
}
beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  onlineManager.setOnline(false);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appChange = listener; return { remove: jest.fn() };
  });
  fetcher = jest.fn().mockImplementation(async (url: string) => url.endsWith('/api/bootstrap') ? response(bootstrap) :
    response({ ...sampleMarket(new URL(url).searchParams.get('symbol')!, '1D'), source: 'Test provider' }));
  global.fetch = fetcher;
});
afterEach(() => {
  global.fetch = originalFetch; AppState.currentState = originalAppState;
  jest.restoreAllMocks(); onlineManager.setOnline(true); jest.useRealTimers();
});

test('cold offline launch makes no requests; disconnect preserves data and foreground/reconnect resume polling', async () => {
  render(<DataProvider><Probe /></DataProvider>);
  expect(screen.getByText('Connect to load portfolio')).toBeTruthy();
  await act(async () => { await jest.advanceTimersByTimeAsync(portfolioRefreshMs * 2); });
  expect(fetcher).not.toHaveBeenCalled();
  act(() => mockNetwork({ isConnected: true, isInternetReachable: true }));
  expect(await screen.findByText('Live snapshot')).toBeTruthy();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(5)); // bootstrap, 3 quotes, authoritative bootstrap
  const count = fetcher.mock.calls.length;
  act(() => appChange('background'));
  await act(async () => { await jest.advanceTimersByTimeAsync(portfolioRefreshMs * 3); });
  expect(fetcher).toHaveBeenCalledTimes(count);
  act(() => appChange('active'));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(count + 5));
  act(() => mockNetwork({ isConnected: false, isInternetReachable: false }));
  expect(screen.getByText('Offline saved snapshot')).toBeTruthy();
  const offlineCount = fetcher.mock.calls.length;
  await act(async () => { await jest.advanceTimersByTimeAsync(portfolioRefreshMs * 3); });
  expect(fetcher).toHaveBeenCalledTimes(offlineCount);
  act(() => mockNetwork({ isConnected: true, isInternetReachable: true }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(offlineCount + 5));
  expect(screen.getByText('Live snapshot')).toBeTruthy();
  expect(fetcher.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
});

test('backgrounding aborts queued/running quote requests and late replies do not reload totals', async () => {
  const finish: (() => void)[] = [];
  const signals: AbortSignal[] = [];
  fetcher.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith('/api/bootstrap')) return Promise.resolve(response(bootstrap));
    signals.push(options.signal!);
    return new Promise(resolve => { finish.push(() => resolve(response({ ...sampleMarket(new URL(url).searchParams.get('symbol')!), source: 'Test provider' }))); });
  });
  render(<DataProvider><Probe /></DataProvider>);
  act(() => mockNetwork({ isConnected: true, isInternetReachable: true }));
  await waitFor(() => expect(signals).toHaveLength(3));
  act(() => appChange('background'));
  expect(signals.every(signal => signal.aborted)).toBe(true);
  await act(async () => { finish.forEach(done => done()); });
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/api/bootstrap'))).toHaveLength(1);
  expect(screen.getByText('Live snapshot')).toBeTruthy();
});

test('unmounting a list row cannot cancel the same quote needed by the holdings refresh', async () => {
  const finish: (() => void)[] = [];
  const signals: AbortSignal[] = [];
  fetcher.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith('/api/bootstrap')) return Promise.resolve(response(bootstrap));
    signals.push(options.signal!);
    return new Promise(resolve => { finish.push(() => resolve(response({ ...sampleMarket(new URL(url).searchParams.get('symbol')!), source: 'Test provider' }))); });
  });
  function Row() { useMarket('NASDAQ:AAPL', '1D'); return <Text>Watchlist row</Text>; }
  const view = render(<DataProvider><Probe /><Row /></DataProvider>);
  act(() => mockNetwork({ isConnected: true, isInternetReachable: true }));
  await waitFor(() => expect(signals).toHaveLength(3));
  view.rerender(<DataProvider><Probe /></DataProvider>);
  expect(signals.every(signal => !signal.aborted)).toBe(true);
  await act(async () => { finish.forEach(done => done()); });
  await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/api/bootstrap'))).toHaveLength(2));
});
