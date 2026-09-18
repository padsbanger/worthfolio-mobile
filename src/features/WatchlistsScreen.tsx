import { useState } from 'react';
import { AssetRow } from '../components/investment-ui';
import { WatchlistPicker } from '../components/WatchlistPicker';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useBootstrap, useData, useListMarkets, usePortfolioRefresh, useVisibleWatchlist, useWatchlists } from '../api/data';
import { DataNotice, RefreshHint, Status, styles } from '../components/ui';
import { money, percent, ticker, timestamp } from '../lib/format';
import { usePullRefresh } from '../components/use-pull-refresh';
import { colors, sizing, spacing } from '../theme/theme';
import type { Market } from '../api/contracts';
import { ExtendedQuote } from '../components/ExtendedQuote';
import { ListControls } from '../components/ListControls';
import { useListPreferences } from './list-preferences';
import { baseUnitPrice, periodChange, periodLabel, priceRates, sortAssets, type ListPeriod } from '../lib/list-view';
import { useWatchlistSelection } from './watchlist-selection';

function WatchRow({ symbol, showDetails, data, changeData, isError, period, sortPrice, currency }: {
  symbol: string; showDetails: boolean; data?: Market; changeData?: Market; isError?: boolean; period: ListPeriod; sortPrice?: number | null; currency: string;
}) {
  const { online, demo } = useData();
  const observation = periodChange(changeData, period);
  const change = observation.value;
  const quoteStatus = [!online && !demo ? 'Offline' : isError ? (data ? 'Update delayed' : 'Unavailable') : !data ? 'Unavailable' : null,
    data?.stale ? 'Stale' : null, data?.cached ? 'Cached' : null, data?.delayed ? 'Provider delayed' : null].filter(Boolean).join(' \u00b7 ');
  return <AssetRow hideChangeLabel symbol={ticker(symbol)} name={data?.name || symbol} logoUrl={data?.logoUrl} logoFallbackUrl={data?.logoFallbackUrl}
    value={money(data?.lastPrice, data?.currency)} change={percent(change)} changeLabel={periodLabel(period)}
    direction={change == null ? undefined : change >= 0 ? 'positive' : 'negative'}
    subtitle={[data?.currency || 'Currency unavailable', timestamp(data?.refreshedAt)].join(' \u00b7 ')}
    secondaryPrice={<ExtendedQuote market={data} />}
    metadata={<>
      {sortPrice !== undefined && <Text style={styles.small}>Sort price: {money(sortPrice, currency)}</Text>}
      {!showDetails && data?.stale && <Text style={[styles.small, { color: colors.warning }]}>Stale</Text>}
      {showDetails && <View style={{ gap: 2 }}>
        <ExtendedQuote market={data} details />
        {!!quoteStatus && <Text style={[styles.small, { color: colors.warning }]}>{quoteStatus}</Text>}
        <Text style={styles.small}>Source: {data?.source || 'Unavailable'}</Text>
        <Text style={styles.small}>Quote time: {data?.refreshedAt || 'Time unavailable'}</Text>
        {period !== '1D' && <Text style={styles.small}>Change source: {changeData?.source || 'Unavailable'} / {timestamp(changeData?.refreshedAt)}</Text>}
        {period !== '1D' && <Text style={styles.small}>{observation.from ? `Observed: ${timestamp(observation.from, true)} to ${timestamp(observation.to, true)}` : 'Insufficient observations for this period'}</Text>}
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
  const view = useListPreferences('watchlists', owner, demo);
  // Changing the change period must never erase a loaded quote/name/logo.
  const quotes = useListMarkets(current?.symbols ?? [], '1D');
  const history = useListMarkets(view.period === '1W' ? current?.symbols ?? [] : [], '1M');
  const markets = view.period === '1W' ? history : quotes;
  const currency = bootstrap.data?.account.baseCurrency || 'USD';
  const rates = priceRates(bootstrap.data?.positions ?? [], currency);
  const symbols = sortAssets(current?.symbols ?? [], view.sort, symbol => {
    const quote = quotes.get(symbol)?.data;
    return { symbol, name: quote?.name || symbol, change: periodChange(markets.get(symbol)?.data, view.period).value,
      price: baseUnitPrice(quote?.lastPrice, quote?.currency || '', rates) };
  });
  const reload = async () => {
    if (!online && !demo) return;
    await result.refetch({ cancelRefetch: false });
    await Promise.all([refresh.refresh(), ...(view.period === '1W' ? [...markets.values()].map(m => m.refetch({ cancelRefetch: false })) : [])]);
  };
  const pullRefresh = usePullRefresh(reload);
  return <View style={styles.screen}><DataNotice />
    <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.section, gap: spacing.small }}>
      <WatchlistPicker lists={lists} selectedId={current?.id} onSelect={select} />
      <ListControls sort={view.sort} period={view.period} currency={currency} loading={[...markets.values()].some(m => m.isFetching && !m.data)} onSort={sort => view.update({ sort })} onPeriod={period => view.update({ period })} onReset={view.reset} />
    </View>
    <FlatList key={`${current?.id}:${view.sort}:${view.period}`} extraData={showDetails} data={symbols} keyExtractor={symbol => symbol} contentContainerStyle={styles.listContent}
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
      renderItem={({ item }) => <WatchRow symbol={item} showDetails={showDetails} period={view.period} data={quotes.get(item)?.data} changeData={markets.get(item)?.data} isError={quotes.get(item)?.isError || markets.get(item)?.isError} currency={currency}
        sortPrice={view.sort.startsWith('price') ? baseUnitPrice(quotes.get(item)?.data?.lastPrice, quotes.get(item)?.data?.currency || '', rates) : undefined} />} />
  </View>;
}
