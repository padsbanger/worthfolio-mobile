import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, focusManager, onlineManager, useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSession } from '../auth/session';
import { server } from '../lib/config';
import { sampleBootstrap, sampleMarket, sampleSearch } from '../fixtures/portfolio';
import { ApiClient, ApiError, retryRead } from './client';
import { MarketQueue } from './market-queue';
import { bootstrapSchema, marketSchema, searchSchema, watchlistsSchema, type ChartRange } from './contracts';

const DataContext = createContext<{ client: ApiClient; marketQueue: MarketQueue; demo: boolean; online: boolean; active: boolean } | null>(null);

export function DataProvider({ children }: PropsWithChildren) {
  const { session, expire } = useSession();
  const [marketQueue] = useState(() => new MarketQueue());
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: {
    retry: retryRead, staleTime: 30_000, gcTime: 5 * 60_000,
  } } }));
  // The signed-in layout keys this entire provider by session ID. Replayed
  // development effects cancel requests without permanently closing its client.
  const [client] = useState(() => new ApiClient(server.url, session?.credential?.accessToken, expire));
  const [online, setOnline] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active');
    const app = AppState.addEventListener('change', state => {
      const focused = state === 'active';
      setActive(focused); focusManager.setFocused(focused);
      if (!focused) void queryClient.cancelQueries();
    });
    const net = NetInfo.addEventListener(state => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      setOnline(connected); onlineManager.setOnline(connected);
      if (!connected) void queryClient.cancelQueries();
    });
    return () => { app.remove(); net(); client.cancelAll(); void queryClient.cancelQueries(); queryClient.clear(); };
  }, [client, queryClient]);
  return <DataContext.Provider value={{ client, marketQueue, demo: session?.demo ?? false, online, active }}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </DataContext.Provider>;
}

export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error('DataProvider is missing');
  return value;
}

export function useBootstrap() {
  const { client, demo, online, active } = useData();
  return useQuery({ queryKey: ['bootstrap'], enabled: demo || (online && active), networkMode: demo ? 'always' : 'online',
    queryFn: ({ signal }) => demo ? Promise.resolve(sampleBootstrap) : client.request('/api/bootstrap', bootstrapSchema, { signal }),
  });
}
export function useWatchlists() {
  const { client, demo, online, active } = useData();
  const focused = useIsFocused();
  return useQuery({ queryKey: ['watchlists'], enabled: demo || (online && active && focused), networkMode: demo ? 'always' : 'online',
    queryFn: ({ signal }) => demo ? Promise.resolve(sampleBootstrap) : client.request('/api/watchlists', watchlistsSchema, { signal }),
  });
}
export function useMarket(symbol: string, range: ChartRange = '1M') {
  const { client, marketQueue, demo, online, active } = useData();
  const focused = useIsFocused();
  return useQuery({ queryKey: ['market', symbol, range], enabled: !!symbol && (demo || (online && active && focused)), networkMode: demo ? 'always' : 'online',
    queryFn: async ({ signal }) => {
      if (demo) return sampleMarket(symbol, range);
      const query = new URLSearchParams({ symbol, range });
      const market = await marketQueue.request(`${symbol}:${range}`, signal,
        () => client.request(`/api/market?${query}`, marketSchema, { signal }));
      if (market.source === 'Offline demo series' || market.lastPrice == null || market.lastPrice <= 0 || market.stale) {
        throw new ApiError('Current market data is unavailable. Keeping the last real observation, if available.', 422);
      }
      return market;
    },
  });
}
export function useSearch(query: string) {
  const { client, demo, online, active } = useData();
  const focused = useIsFocused();
  return useQuery({ queryKey: ['search', query], enabled: query.length >= 2 && (demo || (online && active && focused)), networkMode: demo ? 'always' : 'online',
    queryFn: ({ signal }) => demo ? Promise.resolve(sampleSearch(query))
      : client.request(`/api/search?${new URLSearchParams({ q: query })}`, searchSchema, { signal }),
  });
}
