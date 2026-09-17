import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useBootstrap, useData, useMarket, useWatchlists } from '../api/data';
import { DataNotice, Status, styles } from '../components/ui';
import { money, percent, ticker } from '../lib/format';
import { colors } from '../theme/theme';
import { server } from '../lib/config';

function WatchRow({ symbol }: { symbol: string }) {
  const { data, isError } = useMarket(symbol, '1D');
  const change = data?.lastPrice != null && data.previousClose != null && data.previousClose > 0
    ? (data.lastPrice / data.previousClose - 1) * 100 : null;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${symbol}`}
    onPress={() => router.push({ pathname: '/instrument', params: { symbol } })}
    style={[styles.row, { paddingVertical: 18, minHeight: 90 }]}>
    <View style={{ flex: 1, gap: 5 }}><Text style={styles.text}>{ticker(symbol)}</Text><Text style={styles.small}>{data?.name || symbol}</Text></View>
    <View style={{ alignItems: 'flex-end', gap: 5 }}>
      <Text style={styles.text}>{money(data?.lastPrice, data?.currency)}</Text>
      <Text style={{ color: change == null ? colors.muted : change >= 0 ? colors.positive : colors.negative }}>{percent(change)}</Text>
      <Text style={styles.small}>{isError ? 'Refresh unavailable' : data?.delayed ? 'Provider delayed' : data?.cached ? 'Cached' : data?.source || 'Loading'}</Text>
    </View>
  </Pressable>;
}

export function WatchlistsScreen() {
  const result = useWatchlists();
  const bootstrap = useBootstrap();
  const { demo, online } = useData();
  const [selected, setSelected] = useState<string | null>(null);
  const owner = bootstrap.data?.account.ownerId;
  const preferenceKey = owner ? `watchlist:${server.url}:${owner}` : null;
  useEffect(() => {
    if (!preferenceKey || demo) return;
    let active = true;
    void AsyncStorage.getItem(preferenceKey).then(value => { if (active) setSelected(value); }).catch(() => {});
    return () => { active = false; };
  }, [preferenceKey, demo]);
  const lists = result.data?.watchlists ?? [];
  const current = lists.find(l => l.id === selected) || lists.find(l => l.id === result.data?.activeWatchlistId) || lists[0];
  return <View style={styles.screen}><DataNotice />
    <FlatList data={current?.symbols ?? []} keyExtractor={symbol => symbol} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={result.isRefetching} onRefresh={() => void result.refetch()} tintColor={colors.accent} />}
      ListHeaderComponent={<View style={{ gap: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {lists.map(list => <Pressable key={list.id} accessibilityRole="button" accessibilityState={{ selected: current?.id === list.id }}
            onPress={() => { setSelected(list.id); if (preferenceKey && !demo) void AsyncStorage.setItem(preferenceKey, list.id).catch(() => {}); }}
            style={{ minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: current?.id === list.id ? colors.elevated : colors.surface, borderRadius: 12,
              borderWidth: 1, borderColor: current?.id === list.id ? colors.accent : colors.border }}>
            <Text style={styles.text}>{list.name}</Text>
          </Pressable>)}
        </ScrollView>
        <Text style={styles.small}>Browse your saved lists. Manage them in Worthfolio on the web.</Text>
        {result.isError && <Status title="Watchlists unavailable" message={result.error.message} retry={() => void result.refetch()} />}
      </View>}
      ListEmptyComponent={<Status title={!online && !demo && !result.data ? 'Connect to load watchlists' : result.isPending ? 'Loading watchlists' : current ? 'This list is empty' : 'No watchlists yet'}
        loading={result.isPending && (online || demo)} />}
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      renderItem={({ item }) => <WatchRow symbol={item} />} />
  </View>;
}
