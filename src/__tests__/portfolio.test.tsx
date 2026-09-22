import { act, render, screen, fireEvent, within } from '@testing-library/react-native';
import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { HoldingRow, PortfolioScreen } from '../features/PortfolioScreen';
import { sampleBootstrap, sampleMarket } from '../fixtures/portfolio';
import { useBootstrap, useData, useListMarkets, usePortfolioRefresh } from '../api/data';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../api/data', () => ({
  useBootstrap: jest.fn(), useData: jest.fn(),
  usePortfolioRefresh: jest.fn(), useListMarkets: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(useListMarkets).mockImplementation(symbols => new Map(symbols.map(symbol => [symbol, { data: sampleMarket(symbol), refetch: jest.fn() }])) as unknown as ReturnType<typeof useListMarkets>);
  jest.mocked(useData).mockReturnValue({ online: true, demo: true } as ReturnType<typeof useData>);
  jest.mocked(usePortfolioRefresh).mockReturnValue({ refreshing: false, error: null, completedAt: null, refresh: jest.fn().mockResolvedValue(undefined) });
});

test('portfolio keeps the header focused on holdings rather than quote provenance or coverage', () => {
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap } as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.queryByLabelText('Quote details')).toBeNull();
  expect(screen.queryByText(/holdings valued/)).toBeNull();
  expect(screen.queryByText(/coverage/)).toBeNull();
  expect(screen.queryByText(/Quote time:/)).toBeNull();
  expect(screen.queryByText(sampleBootstrap.account.name)).toBeNull();
  expect(screen.queryByText(/Holdings value/)).toBeNull();
  expect(screen.queryByText('Source: Development fixture')).toBeNull();
});

test('short positions preserve signed value, gain, and currency labels in the new row', () => {
  render(<HoldingRow position={{ ...sampleBootstrap.positions[0]!, quantity: -2, avgPrice: 180, lastPrice: 150 }} currency="USD" />);
  expect(screen.getByText('-$300.00')).toBeTruthy();
  expect(screen.getByText('+$60.00')).toBeTruthy();
  expect(screen.getByText(/-2 units · Short/)).toBeTruthy();
  expect(screen.getByText('Open P&L · USD')).toBeTruthy();
});

test('missing FX and stale valuations stay visible with details collapsed', () => {
  render(<HoldingRow position={{ ...sampleBootstrap.positions[0]!, currency: 'EUR', baseRate: null, cached: true, delayed: true, stale: true }} currency="USD" />);
  expect(screen.getAllByText('Unavailable')).toHaveLength(2);
  expect(screen.getByText('Valuation unavailable · Stale')).toBeTruthy();
  expect(screen.queryByText('$0.00')).toBeNull();
});

test('holding delay metadata does not consume compact portfolio row space', () => {
  const props = { position: { ...sampleBootstrap.positions[0]!, delayed: true }, currency: 'USD',
    period: '1D' as const, market: { ...sampleMarket('NASDAQ:AAPL'), delayed: true } };
  render(<HoldingRow {...props} />);
  expect(screen.queryByText(/delayed/i)).toBeNull();
  expect(screen.queryByText(/Source:/)).toBeNull();
});

test('offline portfolio keeps values and disables the pull gesture', () => {
  jest.mocked(useData).mockReturnValue({ online: false, demo: false } as ReturnType<typeof useData>);
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap } as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('$16,800.00')).toBeTruthy();
  expect(screen.queryByText('Daily change')).toBeNull();
  expect(screen.getByText(/Offline/)).toBeTruthy();
  expect(screen.UNSAFE_getByType(RefreshControl).props.enabled).toBe(false);
});

test('portfolio renders authoritative totals, labels sample data, and opens a holding', () => {
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap, isError: false, isRefetching: false, refetch: jest.fn() } as unknown as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('$16,800.00')).toBeTruthy();
  expect(screen.queryByText('Daily change')).toBeNull();
  expect(screen.getByText('SAMPLE DATA · Development preview')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Open Apple'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/instrument', params: { symbol: 'NASDAQ:AAPL' } });
  jest.mocked(router.push).mockClear();
  fireEvent.press(within(screen.getByLabelText('Open Apple')).getByText('Open P&L +$600.00'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/instrument', params: { symbol: 'NASDAQ:AAPL' } });
});

test('empty portfolio is distinguished from a failed load', () => {
  jest.mocked(useBootstrap).mockReturnValue({ data: { ...sampleBootstrap, positions: [] }, isError: false, refetch: jest.fn() } as unknown as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('No open holdings')).toBeTruthy();
});

test('an initial portfolio load uses structural placeholders instead of unavailable financial values', () => {
  jest.mocked(useBootstrap).mockReturnValue({ isPending: true, isError: false } as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByLabelText('Loading portfolio')).toBeTruthy();
  expect(screen.queryByText('Unavailable')).toBeNull();
  expect(screen.queryByText('Try again')).toBeNull();
});

test('portfolio keeps the server total without adding coverage diagnostics', () => {
  const data = { ...sampleBootstrap, cash: 100000,
    portfolioSummary: { ...sampleBootstrap.portfolioSummary, value: 321, coverage: 50, pricedPositions: 1, totalPositions: 2 } };
  jest.mocked(useBootstrap).mockReturnValue({ data, isError: false } as unknown as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('$321.00')).toBeTruthy();
  expect(screen.queryByText('$100,321.00')).toBeNull();
  expect(screen.queryByText(/Partial valuation/)).toBeNull();
  expect(screen.queryByText(/1 of 2 holdings valued/)).toBeNull();
});


test('background refresh stays quiet while a manual pull shows progress until completion', async () => {
  let finish!: () => void;
  const refresh = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  jest.mocked(usePortfolioRefresh).mockReturnValue({ refreshing: true, error: null, completedAt: null, refresh });
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap } as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  expect(screen.UNSAFE_getByType(FlatList).props.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 0 });
  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);
  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByText('$16,800.00')).toBeTruthy();
  expect(screen.queryByText('Daily change')).toBeNull();
  await act(async () => finish());
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
});

test('failed background refresh preserves holdings with a compact retry hint', () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  jest.mocked(usePortfolioRefresh).mockReturnValue({ refreshing: false, error: 'Provider request failed', completedAt: null, refresh });
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap, isError: true, error: new Error('Detailed server failure') } as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('$16,800.00')).toBeTruthy();
  expect(screen.queryByText('Daily change')).toBeNull();
  expect(screen.getByLabelText('Open Apple')).toBeTruthy();
  expect(screen.getByText('Updates delayed')).toBeTruthy();
  expect(screen.queryByText('Refresh unavailable')).toBeNull();
  expect(screen.queryByText('Detailed server failure')).toBeNull();
  fireEvent.press(screen.getByLabelText('Retry refresh'));
  expect(refresh).toHaveBeenCalledTimes(1);
});

test('an initial load failure still explains the problem and offers recovery', () => {
  jest.mocked(useBootstrap).mockReturnValue({ isError: true, error: new Error('Server unavailable') } as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('Portfolio unavailable')).toBeTruthy();
  expect(screen.getByText('Server unavailable')).toBeTruthy();
  expect(screen.getByText('Try again')).toBeTruthy();
  expect(screen.queryByText('Updates delayed')).toBeNull();
});


test('portfolio sorts locally by selected-period change and preserves authoritative totals and position P&L', () => {
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap } as ReturnType<typeof useBootstrap>);
  jest.mocked(useListMarkets).mockImplementation(symbols => new Map(symbols.map((symbol, i) => [symbol, {
    data: { ...sampleMarket(symbol), lastPrice: 100 + i * 10, previousClose: 100 },
  }])) as unknown as ReturnType<typeof useListMarkets>);
  render(<PortfolioScreen />);
  fireEvent.press(screen.getByLabelText('Sort assets. Default order'));
  fireEvent.press(screen.getByLabelText('Largest price rises'));
  expect(screen.getAllByLabelText(/^Open /).map(n => n.props.accessibilityLabel)).toEqual(['Open Vanguard Total Stock Market ETF', 'Open Microsoft', 'Open Apple']);
  expect(screen.getByText('$16,800.00')).toBeTruthy();
  expect(screen.queryByText('Daily change')).toBeNull();
  expect(screen.getAllByText('Open P&L +$600.00')).toHaveLength(2);
  fireEvent.press(screen.getByLabelText('1W price change'));
  expect(screen.getByLabelText('1W price change')).toBeSelected();
  expect(useListMarkets).toHaveBeenLastCalledWith(sampleBootstrap.positions.map(p => p.symbol), '1M');
});
