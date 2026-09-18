import { CompanyLogo } from '../components/CompanyLogo';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useBootstrap, useData, useMarket, usePortfolioRefresh, useVisibleWatchlist, useWatchlists } from '../api/data';
import { DataNotice, RefreshHint, Status, styles } from '../components/ui';
import { money, percent, ticker, timestamp } from '../lib/format';
import { usePullRefresh } from '../components/use-pull-refresh';
import { colors, spacing } from '../theme/theme';
import { useWatchlistSelection } from './watchlist-selection';

function WatchRow({ symbol }: { symbol: string }) {
  const { data, isError } = useMarket(symbol, '1D');
  const { online, demo } = useData();
  const change = data?.lastPrice != null && data.previousClose != null && data.previousClose > 0
    ? (data.lastPrice / data.previousClose - 1) * 100 : null;
  const quoteStatus = [!online && !demo ? 'Offline' : isError ? (data ? 'Update delayed' : 'Unavailable') : null,
    data?.source, data?.cached ? 'Cached' : null, data?.delayed ? 'Provider delayed' : null].filter(Boolean).join(' · ');
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${symbol}`}
    onPress={() => router.push({ pathname: '/instrument', params: { symbol } })}
    style={[styles.row, { paddingVertical: spacing.section, minHeight: 88 }]}>
    <View style={{ flex: 1, gap: spacing.tight }}><View style={[styles.row, { gap: 8 }]}><CompanyLogo symbol={symbol} logoUrl={data?.logoUrl} logoFallbackUrl={data?.logoFallbackUrl} />
      <Text style={[styles.text, { flexShrink: 1 }]}>{ticker(symbol)}</Text></View><Text style={styles.small}>{data?.name || symbol}</Text></View>
    <View style={{ flex: 1, alignItems: 'flex-end', gap: spacing.tight }}>
      <Text style={styles.text}>{money(data?.lastPrice, data?.currency)}</Text>
      <Text style={{ color: change == null ? colors.muted : change >= 0 ? colors.positive : colors.negative }}>{percent(change)}</Text>
      <Text style={[styles.small, { textAlign: 'right' }]}>{quoteStatus || 'Unavailable'}</Text>
      {data && <Text style={styles.small}>{timestamp(data.refreshedAt)}</Text>}
    </View>
  </Pressable>;
}

export function WatchlistsScreen() {
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
    <FlatList data={current?.symbols ?? []} keyExtractor={symbol => symbol} contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={pullRefresh.refreshing} enabled={online || demo} onRefresh={() => void pullRefresh.onRefresh()} tintColor={colors.accent} />}
      ListHeaderComponent={<View style={{ gap: spacing.small, marginBottom: spacing.small }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {lists.map(list => <Pressable key={list.id} accessibilityRole="button" accessibilityState={{ selected: current?.id === list.id }}
            onPress={() => select(list.id)}
            style={{ minHeight: 48, paddingHorizontal: spacing.section, justifyContent: 'center', backgroundColor: current?.id === list.id ? colors.elevated : colors.surface, borderRadius: 12,
              borderWidth: 1, borderColor: current?.id === list.id ? colors.accent : colors.border }}>
            <Text style={styles.text}>{list.name}</Text>
          </Pressable>)}
        </ScrollView>
        <Text style={styles.small}>Manage lists on Worthfolio web.</Text>
        {data && (result.isError || refresh.error) && <RefreshHint busy={result.isFetching || refresh.refreshing}
          retry={online || demo ? () => void reload() : undefined} />}
      </View>}
      ListEmptyComponent={result.isError && !data ? <Status title="Watchlists unavailable" message={result.error?.message}
        retry={online || demo ? () => void reload() : undefined} /> : <Status title={!online && !demo && !data ? 'Connect to load watchlists' : result.isPending && !data ? 'Loading watchlists' : current ? 'This list is empty' : 'No watchlists yet'}
        loading={!data && result.isPending && (online || demo)} />}
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      renderItem={({ item }) => <WatchRow symbol={item} />} />
  </View>;
}
