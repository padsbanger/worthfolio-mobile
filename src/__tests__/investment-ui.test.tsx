import { fireEvent, render, screen } from '@testing-library/react-native';
import { AssetRow } from '../components/investment-ui';
import { DesignPreviewScreen } from '../features/DesignPreviewScreen';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
jest.mock('../lib/config', () => ({ server: { url: 'https://worthfolio.test' } }));

test('asset rows preserve the named action, unavailable values, and explicit change meaning', () => {
  const open = jest.fn();
  render(<AssetRow symbol="AAPL" name="Apple" value="Unavailable" change="-$120.00" changeLabel="Open P&L"
    direction="negative" subtitle="20 units" onPress={open} />);
  expect(screen.getByText('Unavailable')).toBeTruthy();
  expect(screen.getByText('-$120.00')).toBeTruthy();
  expect(screen.getByText('Open P&L')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Open Apple'));
  expect(open).toHaveBeenCalledTimes(1);
});

test('reference screen labels fixture data and reveals sample provenance without market requests', () => {
  const request = jest.spyOn(global, 'fetch');
  render(<DesignPreviewScreen />);
  expect(screen.getByText('SAMPLE DATA · Design preview')).toBeTruthy();
  expect(screen.getByText('$16,800.00')).toBeTruthy();
  expect(screen.queryByText(/Static sample prices/)).toBeNull();
  fireEvent.press(screen.getByText('Sample quote details'));
  expect(screen.getByText(/Static sample prices/)).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  request.mockRestore();
});
