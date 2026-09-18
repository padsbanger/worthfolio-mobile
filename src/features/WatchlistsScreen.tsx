import { useState } from 'react';
import { AssetRow } from '../components/investment-ui';
import { WatchlistPicker } from '../components/WatchlistPicker';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useBootstrap, useData, useMarket, usePortfolioRefresh, useVisibleWatchlist, useWatchlists } from '../api/data';
import { DataNotice, RefreshHint, Status, styles } from '../components/ui';
import { money, percent, ticker, timestamp } from '../lib/format';
import { usePullRefresh } from '../components/use-pull-refresh';
import { colors, sizing, spacing } from '../theme/theme';
import { useWatchlistSelection } from './watchlist-selection';

function WatchRow({ symbol, showDetails }: { symbol: string; showDetails: boolean }) {
  const { data, isError } = useMarket(symbol, '1D');
  const { online, demo } = useData();
  const change = data?.lastPrice != null && data.previousClose != null && data.previousClose > 0
    ? (data.lastPrice / data.previousClose - 1) * 100 : null;
  const quoteStatus = [!online && !demo ? 'Offline' : isError ? (data ? 'Update delayed' : 'Unavailable') : !data ? 'Unavailable' : null,
    data?.stale ? 'Stale' : null, data?.cached ? 'Cached' : null, data?.delayed ? 'Provider delayed' : null].filter(Boolean).join(' \u00b7 ');
  return <AssetRow symbol={ticker(symbol)} name={data?.name || symbol} logoUrl={data?.logoUrl} logoFallbackUrl={data?.logoFallbackUrl}
    value={money(data?.lastPrice, data?.currency)} change={percent(change)} changeLabel="Daily change"
    direction={change == null ? undefined : change >= 0 ? 'positive' : 'negative'}
    subtitle={[data?.currency || 'Currency unavailable', timestamp(data?.refreshedAt)].join(' \u00b7 ')}
    metadata={<>
      {!!quoteStatus && <Text style={[styles.small, { color: colors.warning }]}>{quoteStatus}</Text>}
      {showDetails && <View style={{ gap: 2 }}>
        <Text style={styles.small}>Source: {data?.source || 'Unavailable'}</Text>
        <Text style={styles.small}>Quote time: {data?.refreshedAt || 'Time unavailable'}</Text>
        <Text style={styles.small}>Previous close: {money(data?.previousClose, data?.currency)}</Text>
      </View>}
    </>}
    onPress={() => router.push({ pathname: '/instrument', params: { symbol } })} />;
}

export function WatchlistsScreen() {
  const [showDetails, setShowDetails] = useState(false);
  const result = useWatchlists();
  const bootstrap = useBootstrap();
  const { demo, online } = useData();
  const refresh = usePortfolioRefresh();
  const owner = bootstrap.data?.account.ownerId;
  const data = result.data ?? bootstrap.data;
  const lists = data?.watchlists ?? [];
  const { current, select } = useWatchlistSelection(data, owner, demo);
  useVisibleWatchlist(current?.symbols ?? []);
  const reload = async () => {
    if (!online && !demo) return;
    await result.refetch({ cancelRefetch: false });
    await refresh.refresh();
  };
  const pullRefresh = usePullRefresh(reload);
  return <View style={styles.screen}><DataNotice />
    <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.section }}>
      <WatchlistPicker lists={lists} selectedId={current?.id} onSelect={select} />
    </View>
    <FlatList key={current?.id || 'empty'} extraData={showDetails} data={current?.symbols ?? []} keyExtractor={symbol => symbol} contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={pullRefresh.refreshing} enabled={online || demo} onRefresh={() => void pullRefresh.onRefresh()} tintColor={colors.accent} />}
      ListHeaderComponent={<View style={{ gap: spacing.small, marginBottom: spacing.small }}>
        <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <Text style={styles.small}>{current?.symbols.length ?? 0} instruments</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Quote details" accessibilityState={{ expanded: showDetails }}
            onPress={() => setShowDetails(value => !value)} style={{ minHeight: sizing.touch, minWidth: sizing.touch, justifyContent: 'center' }}>
            <Text style={[styles.small, { color: colors.accent }]}>{showDetails ? 'Hide details' : 'Quote details'}</Text>
          </Pressable>
        </View>
        {data && (result.isError || refresh.error) && <RefreshHint busy={result.isFetching || refresh.refreshing}
          retry={online || demo ? () => void reload() : undefined} />}
      </View>}
      ListEmptyComponent={result.isError && !data ? <Status title="Watchlists unavailable" message={result.error?.message}
        retry={online || demo ? () => void reload() : undefined} /> : <Status title={!online && !demo && !data ? 'Connect to load watchlists' : result.isPending && !data ? 'Loading watchlists' : current ? 'This list is empty' : 'No watchlists yet'}
        loading={!data && result.isPending && (online || demo)} />}
      renderItem={({ item }) => <WatchRow symbol={item} showDetails={showDetails} />} />
  </View>;
}
