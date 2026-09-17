import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { DataProvider, useBootstrap, useMarket, useSearch, useWatchlists } from '../api/data';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('../auth/session', () => ({
  useSession: () => ({ session: { id: 1, demo: true, credential: null }, expire: jest.fn() }),
}));

// React Query schedules inactive-cache collection after a screen unmounts.
// Keep those five-minute timers inside the test clock.
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function FixtureProbe() {
  const portfolio = useBootstrap();
  const lists = useWatchlists();
  const market = useMarket('NASDAQ:AAPL');
  const search = useSearch('Apple');
  return <Text>{portfolio.data && lists.data && market.data && search.data ? 'All offline fixtures loaded' : 'Loading'}</Text>;
}

test('sample screens load offline without a transport call', async () => {
  const originalFetch = global.fetch;
  const fetcher = jest.fn();
  global.fetch = fetcher;
  onlineManager.setOnline(false);
  try {
    render(<DataProvider><FixtureProbe /></DataProvider>);
    expect(await screen.findByText('All offline fixtures loaded')).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    global.fetch = originalFetch;
    onlineManager.setOnline(true);
  }
});
