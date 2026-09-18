import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'react-native';
import { CompanyLogo, logoUri } from '../components/CompanyLogo';
import { positionSchema, marketSchema, searchSchema } from '../api/contracts';
import { sampleBootstrap, sampleMarket } from '../fixtures/portfolio';

jest.mock('../lib/config', () => ({ server: { url: 'https://worthfolio.test' } }));

test('a broken primary logo tries the backend fallback once, then keeps the ticker initials', () => {
  render(<CompanyLogo symbol="NASDAQ:AAPL" logoUrl="https://images.test/apple.png" logoFallbackUrl="/logos/apple.png" />);
  expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://images.test/apple.png' });
  fireEvent(screen.UNSAFE_getByType(Image), 'error');
  expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://worthfolio.test/logos/apple.png' });
  fireEvent(screen.UNSAFE_getByType(Image), 'error');
  expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  expect(screen.getByText('AA', { includeHiddenElements: true })).toBeTruthy();
});

test('missing and duplicate URLs do not loop; changing the company resets failures', () => {
  const view = render(<CompanyLogo symbol="AAPL" logoUrl="https://images.test/icon.png" logoFallbackUrl="https://images.test/icon.png" />);
  fireEvent(screen.UNSAFE_getByType(Image), 'error');
  expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  view.rerender(<CompanyLogo symbol="MSFT" logoUrl="https://images.test/icon.png" />);
  expect(screen.UNSAFE_getByType(Image)).toBeTruthy();
  view.rerender(<CompanyLogo symbol="MSFT" />);
  expect(screen.UNSAFE_queryByType(Image)).toBeNull();
});

test('logo URLs resolve against the backend and exclude local files and insecure URLs', () => {
  expect(logoUri('/logos/apple.png')).toBe('https://worthfolio.test/logos/apple.png');
  for (const value of [undefined, null, '', 'http://images.test/a.png', 'file:///private/key', 'data:image/png;base64,test', 'https://user:password@images.test/a']) {
    expect(logoUri(value)).toBeUndefined();
  }
});

test('all instrument contracts retain logos without requiring them on older responses', () => {
  const logos = { logoUrl: 'https://images.test/a.png', logoFallbackUrl: '/logos/a.png' };
  expect(positionSchema.parse({ ...sampleBootstrap.positions[0], ...logos })).toMatchObject(logos);
  expect(marketSchema.parse({ ...sampleMarket('NASDAQ:AAPL'), ...logos })).toMatchObject(logos);
  expect(searchSchema.parse({ results: [{ symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ', assetType: 'stock', ...logos }] }).results[0]).toMatchObject(logos);
  expect(positionSchema.safeParse({ ...sampleBootstrap.positions[0], logoUrl: null, logoFallbackUrl: 123 }).success).toBe(true);
  expect(marketSchema.safeParse(sampleMarket('NASDAQ:AAPL')).success).toBe(true);
});
