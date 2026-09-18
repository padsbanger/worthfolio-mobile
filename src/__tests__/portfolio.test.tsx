import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { HoldingRow, PortfolioScreen } from '../features/PortfolioScreen';
import { sampleBootstrap } from '../fixtures/portfolio';
import { useBootstrap, useData, usePortfolioRefresh } from '../api/data';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../api/data', () => ({
  useBootstrap: jest.fn(), useData: jest.fn(),
  usePortfolioRefresh: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(useData).mockReturnValue({ online: true, demo: true } as ReturnType<typeof useData>);
  jest.mocked(usePortfolioRefresh).mockReturnValue({ refreshing: false, error: null, completedAt: null, refresh: jest.fn().mockResolvedValue(undefined) });
});

test('quote details disclose each source and exact time without hiding summary freshness', () => {
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap } as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText(/Quote time:/)).toBeTruthy();
  expect(screen.queryByText('Source: Development fixture')).toBeNull();
  fireEvent.press(screen.getByLabelText('Quote details'));
  expect(screen.getByLabelText('Quote details').props.accessibilityState.expanded).toBe(true);
  expect(screen.getAllByText('Source: Development fixture')).toHaveLength(3);
  expect(screen.getAllByText(`Quote time: ${sampleBootstrap.positions[0]!.quoteRefreshedAt}`)).toHaveLength(3);
  expect(screen.getByText(/Summary timestamp:/)).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Quote details'));
  expect(screen.queryByText(/Summary timestamp:/)).toBeNull();
});

test('short positions preserve signed value, gain, and currency labels in the new row', () => {
  render(<HoldingRow position={{ ...sampleBootstrap.positions[0]!, quantity: -2, avgPrice: 180, lastPrice: 150 }} currency="USD" />);
  expect(screen.getByText('-$300.00')).toBeTruthy();
  expect(screen.getByText('+$60.00')).toBeTruthy();
  expect(screen.getByText(/-2 units · Short/)).toBeTruthy();
  expect(screen.getByText('Open P&L · USD')).toBeTruthy();
});

test('missing FX and quote exceptions stay visible with details collapsed', () => {
  render(<HoldingRow position={{ ...sampleBootstrap.positions[0]!, currency: 'EUR', baseRate: null, cached: true, delayed: true, stale: true }} currency="USD" />);
  expect(screen.getAllByText('Unavailable')).toHaveLength(2);
  expect(screen.getByText('Valuation unavailable · Stale · Cached · Provider delayed')).toBeTruthy();
  expect(screen.queryByText('$0.00')).toBeNull();
});

test('offline portfolio keeps values and disables the pull gesture', () => {
  jest.mocked(useData).mockReturnValue({ online: false, demo: false } as ReturnType<typeof useData>);
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap } as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('$16,800.00')).toBeTruthy();
  expect(screen.getByText(/Offline/)).toBeTruthy();
  expect(screen.UNSAFE_getByType(RefreshControl).props.enabled).toBe(false);
});

test('portfolio renders authoritative totals, labels sample data, and opens a holding', () => {
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap, isError: false, isRefetching: false, refetch: jest.fn() } as unknown as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('$16,800.00')).toBeTruthy();
  expect(screen.getByText('SAMPLE DATA · Development preview')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Open Apple'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/instrument', params: { symbol: 'NASDAQ:AAPL' } });
});

test('empty portfolio is distinguished from a failed load', () => {
  jest.mocked(useBootstrap).mockReturnValue({ data: { ...sampleBootstrap, positions: [] }, isError: false, refetch: jest.fn() } as unknown as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('No open holdings')).toBeTruthy();
});

test('partial header uses server totals even when position values or account cash differ', () => {
  const data = { ...sampleBootstrap, cash: 100000,
    portfolioSummary: { ...sampleBootstrap.portfolioSummary, value: 321, coverage: 50, pricedPositions: 1, totalPositions: 2 } };
  jest.mocked(useBootstrap).mockReturnValue({ data, isError: false } as unknown as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('$321.00')).toBeTruthy();
  expect(screen.queryByText('$100,321.00')).toBeNull();
  expect(screen.getByText('Partial valuation: some prices or currency conversions are unavailable.')).toBeTruthy();
  expect(screen.getByText(/1 of 2 holdings valued/)).toBeTruthy();
});


test('background refresh stays quiet while a manual pull shows progress until completion', async () => {
  let finish!: () => void;
  const refresh = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  jest.mocked(usePortfolioRefresh).mockReturnValue({ refreshing: true, error: null, completedAt: null, refresh });
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap } as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);
  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByText('$16,800.00')).toBeTruthy();
  await act(async () => finish());
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
});

test('failed background refresh preserves holdings with a compact retry hint', () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  jest.mocked(usePortfolioRefresh).mockReturnValue({ refreshing: false, error: 'Provider request failed', completedAt: null, refresh });
  jest.mocked(useBootstrap).mockReturnValue({ data: sampleBootstrap, isError: true, error: new Error('Detailed server failure') } as ReturnType<typeof useBootstrap>);
  render(<PortfolioScreen />);
  expect(screen.getByText('$16,800.00')).toBeTruthy();
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
