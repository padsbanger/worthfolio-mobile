import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, QueryObserver, focusManager, onlineManager, useQueries, useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSession } from '../auth/session';
import { server } from '../lib/config';
import { sampleBootstrap, sampleMarket, sampleSearch } from '../fixtures/portfolio';
import { ApiClient, retryRead } from './client';
import { MarketQueue } from './market-queue';
import { searchSchema, type Bootstrap, type ChartRange } from './contracts';
import { createDataQueries } from './queries';
import { PortfolioRefresh } from './portfolio-refresh';

const DataContext = createContext<{ client: ApiClient; demo: boolean; online: boolean; active: boolean;
  queries: ReturnType<typeof createDataQueries>; refresh: PortfolioRefresh; queryClient: QueryClient;
} | null>(null);

export function DataProvider({ children }: PropsWithChildren) {
  const { session, expire } = useSession();
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: {
    retry: retryRead, staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false,
  } } }));
  // The signed-in layout keys this entire provider by session ID. Replayed
  // development effects cancel requests without permanently closing its client.
  const [client] = useState(() => new ApiClient(server.url, session?.credential?.accessToken, expire));
  const [queries] = useState(() => createDataQueries(client, new MarketQueue(), queryClient));
  const [refresh] = useState(() => new PortfolioRefresh({
    cachedBootstrap: () => queryClient.getQueryData<Bootstrap>(['bootstrap']),
    bootstrap: force => queryClient.fetchQuery({ ...queries.bootstrap, staleTime: force ? 0 : 30_000 }),
    market: async (symbol, force) => {
      const options = { ...queries.market(symbol, '1D'), staleTime: force ? 0 : 30_000 };
      // A list row may unmount while a holdings round still needs the same query.
      // Keep that round subscribed so Query cancels only when all owners leave.
      const observer = new QueryObserver(queryClient, { ...options, enabled: false });
      const unsubscribe = observer.subscribe(() => {});
      try { return await queryClient.fetchQuery(options); } finally { unsubscribe(); }
    },
    cancel: () => { client.cancelAll(); void queryClient.cancelQueries(); },
  }));
  const demo = session?.demo ?? false;
  const [online, setOnline] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let foreground = AppState.currentState === 'active';
    let connected = false;
    const sync = () => refresh.setEnabled(foreground && connected && !demo);
    focusManager.setFocused(foreground);
    const app = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      sync();
      setActive(foreground); focusManager.setFocused(foreground);
      if (!foreground) { client.cancelAll(); void queryClient.cancelQueries(); }
    });
    const net = NetInfo.addEventListener(state => {
      connected = state.isConnected === true && state.isInternetReachable !== false;
      onlineManager.setOnline(connected);
      sync(); setOnline(connected);
      if (!connected) { client.cancelAll(); void queryClient.cancelQueries(); }
    });
    return () => { app.remove(); net(); refresh.setEnabled(false); client.cancelAll(); void queryClient.cancelQueries(); queryClient.clear(); };
  }, [client, queryClient, refresh, demo]);
  return <DataContext.Provider value={{ client, demo, online, active, queries, queryClient, refresh }}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </DataContext.Provider>;
}

export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error('DataProvider is missing');
  return value;
}

export function useBootstrap() {
  const { queries, demo, online, active } = useData();
  return useQuery({ ...queries.bootstrap, enabled: demo || (online && active), networkMode: demo ? 'always' : 'online',
    ...(demo ? { queryFn: () => Promise.resolve(sampleBootstrap) } : {}),
  });
}
export function useWatchlists() {
  const { queries, queryClient, demo, online, active } = useData();
  const focused = useIsFocused();
  useEffect(() => {
    if (focused && online && active && !demo) void queryClient.fetchQuery({ ...queries.watchlists, staleTime: 0 }).catch(() => {});
  }, [queries, queryClient, focused, online, active, demo]);
  return useQuery({ ...queries.watchlists, enabled: demo || (online && active && focused), networkMode: demo ? 'always' : 'online',
    ...(demo ? { queryFn: () => Promise.resolve(sampleBootstrap) } : {}),
  });
}
export function selectedRefreshMs(seconds?: number) {
  return Number.isFinite(seconds) && seconds! > 0 ? Math.max(1_000, seconds! * 1_000) : 5_000;
}

export function useMarket(symbol: string, range: ChartRange = '1M', refreshSeconds?: number | null) {
  const { queries, demo, online, active } = useData();
  const focused = useIsFocused();
  const enabled = !!symbol && focused && (demo || (online && active));
  return useQuery({ ...queries.market(symbol, range), enabled, subscribed: focused, networkMode: demo ? 'always' : 'online',
    // Query's interval reuses an in-flight fetch. All ranges share the same queue.
    refetchInterval: enabled && !demo && refreshSeconds !== undefined ? selectedRefreshMs(refreshSeconds ?? undefined) : false,
    ...(refreshSeconds !== undefined ? { staleTime: selectedRefreshMs(refreshSeconds ?? undefined) } : {}),
    ...(demo ? { queryFn: () => Promise.resolve(sampleMarket(symbol, range)) } : {}),
  });
}
export function useSearch(query: string, settled = true) {
  const { client, demo, online, active } = useData();
  const focused = useIsFocused();
  return useQuery({ queryKey: ['search', query], subscribed: focused && settled,
    enabled: settled && focused && query.length >= 2 && (demo || (online && active)), networkMode: demo ? 'always' : 'online',
    queryFn: ({ signal }) => demo ? Promise.resolve(sampleSearch(query))
      : client.request(`/api/search?${new URLSearchParams({ q: query })}`, searchSchema, { signal }),
  });
}

/** All list members need observations for ranking, including virtualized rows. */
export function useListMarkets(symbols: string[], range: ChartRange) {
  const { queries, demo, online, active } = useData();
  const focused = useIsFocused();
  const enabled = focused && (demo || (online && active));
  const results = useQueries({ subscribed: focused,
    queries: symbols.map(symbol => ({ ...queries.market(symbol, range), enabled,
      networkMode: demo ? 'always' as const : 'online' as const,
      // Daily data is refreshed by the existing shared holdings/watchlist round.
      refetchInterval: enabled && !demo && range !== '1D' ? 90_000 : false as const,
      ...(demo ? { queryFn: () => Promise.resolve(sampleMarket(symbol, range)) } : {}),
    })),
  });
  return new Map(symbols.map((symbol, index) => [symbol, results[index]!]));
}

export function usePortfolioRefresh() {
  const { refresh } = useData();
  const state = useSyncExternalStore(refresh.subscribe, refresh.getSnapshot, refresh.getSnapshot);
  return { ...state, refresh: refresh.refresh };
}

export function useVisibleWatchlist(symbols: string[]) {
  const { refresh } = useData();
  const focused = useIsFocused();
  const key = JSON.stringify(symbols);
  useEffect(() => {
    refresh.setWatchSymbols(focused ? JSON.parse(key) as string[] : []);
    return () => refresh.setWatchSymbols([]);
  }, [refresh, key, focused]);
}
