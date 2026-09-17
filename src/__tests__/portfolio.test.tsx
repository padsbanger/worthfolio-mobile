import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PortfolioScreen } from '../features/PortfolioScreen';
import { sampleBootstrap } from '../fixtures/portfolio';
import { useBootstrap } from '../api/data';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../api/data', () => ({
  useBootstrap: jest.fn(), useData: () => ({ online: true, demo: true }),
  usePortfolioRefresh: () => ({ refreshing: false, error: null, refresh: jest.fn() }),
}));

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
