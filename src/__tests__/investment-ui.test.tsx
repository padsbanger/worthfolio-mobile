import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
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

test('asset rows keep a long identity and supporting line compact while retaining full accessible meaning', () => {
  const name = 'A very long company name that must not push financial values off screen';
  const subtitle = '1,234.56789 units \u00b7 Long \u00b7 $123,456.78 / unit';
  render(<AssetRow symbol="NASDAQ:EXAMPLE" name={name} value="$123,456,789.00" change="+12.34%"
    changeLabel="Daily change" hideChangeLabel subtitle={subtitle} secondaryPrice={<Text>After $123.45 +1.00%</Text>} />);
  expect(screen.getByText(name).props.numberOfLines).toBe(1);
  expect(screen.getByText(subtitle).props.numberOfLines).toBe(1);
  expect(screen.getByText('$123,456,789.00')).toBeTruthy();
  expect(screen.getByText('After $123.45 +1.00%')).toBeTruthy();
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
