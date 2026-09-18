import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { WatchlistsScreen } from '../features/WatchlistsScreen';
import { selectedWatchlist, useWatchlistSelection } from '../features/watchlist-selection';
import { useBootstrap, useData, useListMarkets, useMarket, usePortfolioRefresh, useWatchlists } from '../api/data';
import { sampleBootstrap, sampleMarket } from '../fixtures/portfolio';
import type { Watchlists } from '../api/contracts';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../lib/config', () => ({ server: { url: 'https://worthfolio.test' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../api/data', () => ({ useBootstrap: jest.fn(), useData: jest.fn(), useMarket: jest.fn(), useListMarkets: jest.fn(),
  usePortfolioRefresh: jest.fn(), useVisibleWatchlist: jest.fn(), useWatchlists: jest.fn() }));

const data: Watchlists = { watchlists: sampleBootstrap.watchlists, activeWatchlistId: 'sample-core' };
const refetch = jest.fn();
const refresh = jest.fn();
const saved = jest.mocked(AsyncStorage.getItem);
const save = jest.mocked(AsyncStorage.setItem);
beforeEach(() => {
  jest.mocked(useListMarkets).mockImplementation(symbols => new Map(symbols.map(symbol => [symbol, useMarket(symbol, '1D')])) as ReturnType<typeof useListMarkets>);
  saved.mockReset().mockResolvedValue(null); save.mockReset().mockResolvedValue();
  refetch.mockReset().mockResolvedValue({ data }); refresh.mockReset().mockResolvedValue(undefined);
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap } as ReturnType<typeof useBootstrap>);
  jest.mocked(useData).mockReturnValue({ online: true, demo: false } as ReturnType<typeof useData>);
  jest.mocked(usePortfolioRefresh).mockReturnValue({ refreshing: false, error: null, completedAt: null, refresh });
  jest.mocked(useWatchlists).mockReturnValue({ data, refetch } as unknown as ReturnType<typeof useWatchlists>);
  jest.mocked(useMarket).mockImplementation(symbol => ({ data: sampleMarket(symbol, '1D') }) as ReturnType<typeof useMarket>);
});

test('list selection is local and opens instruments without changing server selection', async () => {
  render(<WatchlistsScreen />);
  await waitFor(() => expect(saved).toHaveBeenCalled());
  fireEvent.press(screen.getByLabelText(/Choose watchlist\./));
  fireEvent.press(screen.getByText('On my radar'));
  expect(screen.getByLabelText('Open Bitcoin / US dollar')).toBeTruthy();
  await waitFor(() => expect(save).toHaveBeenCalledWith('watchlist:https://worthfolio.test:sample', 'sample-explore'));
  fireEvent.press(screen.getByLabelText('Open Bitcoin / US dollar'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/instrument', params: { symbol: 'BTC-USD' } });
  expect(data.activeWatchlistId).toBe('sample-core');
  expect(refetch).not.toHaveBeenCalled();
});

test('pull-to-refresh reloads lists and the shared quote round', async () => {
  render(<WatchlistsScreen />);
  await act(async () => { fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh'); });
  expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(refresh.mock.invocationCallOrder[0]).toBeGreaterThan(refetch.mock.invocationCallOrder[0]!);
});

test('failed refresh discloses provenance and delay flags only in quote details', async () => {
  jest.mocked(useMarket).mockImplementation(symbol => ({ isError: true,
    data: { ...sampleMarket(symbol, '1D'), source: 'Test provider', cached: true, delayed: true },
  }) as ReturnType<typeof useMarket>);
  render(<WatchlistsScreen />);
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(screen.queryByText(/delayed/i)).toBeNull();
  fireEvent.press(screen.getByLabelText('Quote details'));
  expect(screen.getAllByText('Source: Test provider')).toHaveLength(3);
  expect(screen.getAllByText('Update delayed · Cached · Provider delayed').length).toBeGreaterThan(0);
  fireEvent.press(screen.getByLabelText('Quote details'));
  expect(screen.queryByText(/delayed/i)).toBeNull();
});

test('empty selected list is different from no lists or an offline initial load', async () => {
  const view = render(<WatchlistsScreen />);
  fireEvent.press(screen.getByLabelText(/Choose watchlist\./));
  fireEvent.press(screen.getByText('New ideas'));
  expect(screen.getByText('This list is empty')).toBeTruthy();
  await act(async () => {});
  jest.mocked(useWatchlists).mockReturnValue({ data: { watchlists: [], activeWatchlistId: null } } as unknown as ReturnType<typeof useWatchlists>);
  view.rerender(<WatchlistsScreen />);
  expect(screen.getByText('No watchlists yet')).toBeTruthy();
  jest.mocked(useData).mockReturnValue({ online: false, demo: false } as ReturnType<typeof useData>);
  jest.mocked(useBootstrap).mockReturnValue({} as ReturnType<typeof useBootstrap>);
  jest.mocked(useWatchlists).mockReturnValue({ isPending: true } as ReturnType<typeof useWatchlists>);
  view.rerender(<WatchlistsScreen />);
  expect(screen.getByText('Connect to load watchlists')).toBeTruthy();
});

test('an initial watchlists load uses row-shaped placeholders and does not show an empty selector', () => {
  jest.mocked(useBootstrap).mockReturnValue({} as ReturnType<typeof useBootstrap>);
  jest.mocked(useWatchlists).mockReturnValue({ isPending: true, isError: false } as ReturnType<typeof useWatchlists>);
  render(<WatchlistsScreen />);
  expect(screen.getByLabelText('Loading watchlists')).toBeTruthy();
  expect(screen.queryByLabelText(/Choose watchlist/)).toBeNull();
  expect(screen.queryByText('No watchlists yet')).toBeNull();
});

test('deleted or missing lists fall back to the server active list, first list, or empty state', () => {
  expect(selectedWatchlist(data, 'deleted')?.id).toBe('sample-core');
  expect(selectedWatchlist({ ...data, activeWatchlistId: 'deleted' }, 'also-deleted')?.id).toBe('sample-core');
  expect(selectedWatchlist({ watchlists: [], activeWatchlistId: null }, 'old')).toBeUndefined();
  expect(selectedWatchlist(undefined, null)).toBeUndefined();
});

test('a delayed preference read cannot override a choice already made on screen', async () => {
  let finish!: (id: string) => void;
  saved.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useWatchlistSelection(data, 'owner', false));
  act(() => result.current.select('sample-explore'));
  await act(async () => finish('sample-core'));
  expect(result.current.current?.id).toBe('sample-explore');
});

test('a different account cannot inherit the previous account preference or late load', async () => {
  let finish!: (id: string) => void;
  saved.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(null);
  const { result, rerender } = renderHook<ReturnType<typeof useWatchlistSelection>, { owner: string }>(
    ({ owner }) => useWatchlistSelection(data, owner, false), { initialProps: { owner: 'first' } });
  rerender({ owner: 'second' });
  await act(async () => finish('sample-explore'));
  expect(result.current.current?.id).toBe('sample-core');
  expect(saved).toHaveBeenLastCalledWith('watchlist:https://worthfolio.test:second');
});


test('background list and quote refresh does not show pull progress or change row labels', async () => {
  jest.mocked(useWatchlists).mockReturnValue({ data, refetch, isRefetching: true } as unknown as ReturnType<typeof useWatchlists>);
  jest.mocked(usePortfolioRefresh).mockReturnValue({ refreshing: true, error: null, completedAt: null, refresh });
  jest.mocked(useMarket).mockImplementation(symbol => ({ data: sampleMarket(symbol, '1D'), isFetching: true }) as ReturnType<typeof useMarket>);
  render(<WatchlistsScreen />);
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  expect(screen.UNSAFE_getByType(FlatList).props.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 0 });
  expect(screen.queryByText(/Refreshing/)).toBeNull();
  expect(screen.getByLabelText('Open Apple')).toBeTruthy();
});

test('watchlists without cached data retain a full error and retry action', async () => {
  jest.mocked(useBootstrap).mockReturnValue({} as ReturnType<typeof useBootstrap>);
  jest.mocked(useWatchlists).mockReturnValue({ isError: true, error: new Error('Server unavailable'), refetch } as unknown as ReturnType<typeof useWatchlists>);
  render(<WatchlistsScreen />);
  expect(screen.getByText('Watchlists unavailable')).toBeTruthy();
  expect(screen.getByText('Server unavailable')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Try again')));
  expect(refetch).toHaveBeenCalled();
});


test('restored selection stays named in the selector and can be changed or dismissed', async () => {
  saved.mockResolvedValue('sample-explore');
  render(<WatchlistsScreen />);
  await waitFor(() => expect(screen.getByLabelText('Choose watchlist. On my radar')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Choose watchlist. On my radar'));
  expect(screen.getByRole('button', { name: 'On my radar', selected: true })).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close watchlist selector'));
  expect(screen.queryByLabelText('Close watchlist selector')).toBeNull();
  expect(screen.getByLabelText('Choose watchlist. On my radar')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Choose watchlist. On my radar'));
  fireEvent.press(screen.getByLabelText('Core holdings'));
  expect(screen.getByLabelText('Choose watchlist. Core holdings')).toBeTruthy();
  expect(screen.getByLabelText('Open Apple')).toBeTruthy();
  await waitFor(() => expect(save).toHaveBeenLastCalledWith('watchlist:https://worthfolio.test:sample', 'sample-core'));
});

test('daily change and stale flags stay visible while exact provenance can be collapsed', async () => {
  jest.mocked(useMarket).mockImplementation(symbol => ({ data: { ...sampleMarket(symbol, '1D'), stale: true } }) as ReturnType<typeof useMarket>);
  render(<WatchlistsScreen />);
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(screen.queryByText('Daily change')).toBeNull();
  expect(screen.getByLabelText('Open Apple').props.accessibilityHint).toContain('Daily change');
  expect(screen.getAllByText('+1.20%')).toHaveLength(3);
  expect(screen.getAllByText('Stale')).toHaveLength(3);
  expect(screen.queryByText(/Source:/)).toBeNull();
  fireEvent.press(screen.getByLabelText('Quote details'));
  expect(screen.getAllByText(/Source:/)).toHaveLength(3);
  expect(screen.getAllByText(/Previous close:/)).toHaveLength(3);
  fireEvent.press(screen.getByLabelText('Quote details'));
  expect(screen.queryByText(/Source:/)).toBeNull();
  expect(screen.getAllByText('Stale')).toHaveLength(3);
});

test('missing quote and previous close never display a zero return', async () => {
  jest.mocked(useMarket).mockReturnValue({ isError: true } as ReturnType<typeof useMarket>);
  render(<WatchlistsScreen />);
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
  expect(screen.queryByText('0.00%')).toBeNull();
  expect(screen.queryByText('$0.00')).toBeNull();
});

test('a first quote request reserves a row without showing unavailable or replacing loaded data', async () => {
  jest.mocked(useListMarkets).mockImplementation(symbols => new Map(symbols.map(symbol => [symbol, { isFetching: true }])) as ReturnType<typeof useListMarkets>);
  render(<WatchlistsScreen />);
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(screen.getByLabelText('Loading AAPL quote')).toBeTruthy();
  expect(screen.queryByText('Unavailable')).toBeNull();
  expect(screen.queryByLabelText('Open Apple')).toBeNull();
});


test('watchlist alphabetical and price sorts use all list quotes without changing membership', async () => {
  render(<WatchlistsScreen />);
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('Sort assets. Default order'));
  fireEvent.press(screen.getByLabelText('Highest price'));
  expect(screen.getAllByLabelText(/^Open /).map(n => n.props.accessibilityLabel)).toEqual(['Open Microsoft', 'Open Vanguard Total Stock Market ETF', 'Open Apple']);
  fireEvent.press(screen.getByLabelText('Sort assets. Highest price'));
  fireEvent.press(screen.getByLabelText('Alphabetical'));
  expect(screen.getAllByLabelText(/^Open /).map(n => n.props.accessibilityLabel)).toEqual(['Open Apple', 'Open Microsoft', 'Open Vanguard Total Stock Market ETF']);
  expect(data.watchlists[0]!.symbols).toEqual(['NASDAQ:AAPL', 'NASDAQ:MSFT', 'NYSE:VTI']);
  await act(async () => {});
});


test('changing the period retains loaded quote prices and names while missing history stays unavailable', async () => {
  jest.mocked(useListMarkets).mockImplementation((symbols, range) => new Map(symbols.map(symbol => [symbol,
    range === '1D' ? { data: sampleMarket(symbol, '1D') } : { isFetching: true, data: undefined },
  ])) as unknown as ReturnType<typeof useListMarkets>);
  render(<WatchlistsScreen />);
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('1W price change'));
  expect(screen.getByLabelText('Open Apple')).toBeTruthy();
  expect(screen.getByText('$210.00')).toBeTruthy();
  expect(screen.getByText('Loading 1W changes\u2026')).toBeTruthy();
  expect(screen.getAllByText('Unavailable')).toHaveLength(3);
  expect(screen.queryByText('+1.20%')).toBeNull();
  await act(async () => {});
});
