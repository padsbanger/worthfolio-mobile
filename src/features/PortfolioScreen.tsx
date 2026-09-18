import { AssetRow, PortfolioOverview } from '../components/investment-ui';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useBootstrap, useData, useListMarkets, usePortfolioRefresh } from '../api/data';
import type { Market, Position } from '../api/contracts';
import { DataNotice, Label, ListSkeleton, RefreshHint, Status, styles } from '../components/ui';
import { money, number, percent, positionValues, ticker } from '../lib/format';
import { usePullRefresh } from '../components/use-pull-refresh';
import { ExtendedQuote, extendedQuoteDescription } from '../components/ExtendedQuote';
import { ListControls } from '../components/ListControls';
import { useListPreferences } from './list-preferences';
import { baseUnitPrice, periodChange, periodLabel, priceRates, sortAssets, type ListPeriod } from '../lib/list-view';
import { colors, spacing } from '../theme/theme';

export function HoldingRow({ position, currency, period, market, quoteMarket = market, sortPrice }: { position: Position; currency: string; period?: ListPeriod; market?: Market; quoteMarket?: Market; sortPrice?: number | null }) {
  const values = positionValues(position, position.lastPrice, currency);
  const change = period ? periodChange(market, period) : null;
  const direction = period ? change?.value : values.pnl;
  return <AssetRow hideChangeLabel={!!period} symbol={ticker(position.symbol)} name={position.name || position.symbol}
    logoUrl={position.logoUrl} logoFallbackUrl={position.logoFallbackUrl}
    value={money(values.value, currency)} change={period ? percent(change?.value ?? null) : money(values.pnl, currency, true)} changeLabel={period ? periodLabel(period) : `Open P&L \u00b7 ${currency}`}
    direction={direction == null ? undefined : direction >= 0 ? 'positive' : 'negative'}
    subtitle={`${number(position.quantity)} units \u00b7 ${position.quantity < 0 ? 'Short' : 'Long'} \u00b7 ${money(position.lastPrice, position.currency)} / unit`}
    secondaryPrice={<ExtendedQuote market={quoteMarket} />}
    secondaryDescription={extendedQuoteDescription(quoteMarket)}
    metadata={<>
      {period && <Text style={styles.small}>Open P&amp;L {money(values.pnl, currency, true)}</Text>}
      {sortPrice !== undefined && <Text style={styles.small}>Sort price: {money(sortPrice, currency)}</Text>}
      {(values.value == null || position.stale === true) && <Text style={[styles.small, { color: colors.warning }]}>{[values.value == null ? 'Valuation unavailable' : null, position.stale === true ? 'Stale' : null].filter(Boolean).join(' \u00b7 ')}</Text>}
    </>}
    onPress={() => router.push({ pathname: '/instrument', params: { symbol: position.symbol } })} />;
}

export function PortfolioScreen() {
  const result = useBootstrap();
  const { online, demo } = useData();
  const refresh = usePortfolioRefresh();

  const data = result.data;
  const summary = data?.portfolioSummary;
  const view = useListPreferences('portfolio', data?.account.ownerId, demo);
  const quotes = useListMarkets(data?.positions.map(p => p.symbol) ?? [], '1D');
  const history = useListMarkets(view.period === '1W' ? data?.positions.map(p => p.symbol) ?? [] : [], '1M');
  const markets = view.period === '1W' ? history : quotes;
  const currency = data?.account.baseCurrency || 'USD';
  const rates = priceRates(data?.positions ?? [], currency);
  const positions = sortAssets(data?.positions ?? [], view.sort, p => ({ symbol: p.symbol, name: p.name || p.symbol,
    change: periodChange(markets.get(p.symbol)?.data, view.period).value, price: baseUnitPrice(p.lastPrice, p.currency, rates) }));
  const pullRefresh = usePullRefresh(async () => {
    await Promise.all([refresh.refresh(), ...(view.period === '1W' ? [...markets.values()].map(m => m.refetch({ cancelRefetch: false })) : [])]);
  });
  return <View style={styles.screen}><DataNotice />
    {!data ? result.isPending && (online || demo) ? <ListSkeleton label="Loading portfolio" rows={3} overview /> : <Status title={!online && !demo ? 'Connect to load your portfolio' : result.isError ? 'Portfolio unavailable' : 'Loading your portfolio'}
      message={result.error?.message} loading={result.isPending && (online || demo)} retry={result.isError && (online || demo) ? () => void refresh.refresh() : undefined} />
      : <FlatList key={`${view.sort}:${view.period}`} data={positions} keyExtractor={p => p.symbol} contentContainerStyle={styles.listContent}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={<RefreshControl refreshing={pullRefresh.refreshing} enabled={online || demo} onRefresh={() => void pullRefresh.onRefresh()} tintColor={colors.accent} />}
        ListHeaderComponent={<View style={local.header}>
          <PortfolioOverview balance={summary!.value} currency={summary!.currency}
            pnl={summary!.openPnl} invested={summary!.invested}
            direction={summary!.openPnl >= 0 ? 'positive' : 'negative'} />
          {(result.isError || refresh.error) && <RefreshHint busy={refresh.refreshing}
            retry={online || demo ? () => void refresh.refresh() : undefined} />}
          <View style={styles.divider} />
          <View style={{ gap: spacing.tight }}>
            <Text accessibilityRole="header" style={styles.sectionHeading}>Your holdings</Text>
            <Label>Value in {data.account.baseCurrency} / Price change %</Label>
            <ListControls sort={view.sort} period={view.period} currency={currency} loading={[...markets.values()].some(m => m.isFetching && !m.data)} onSort={sort => view.update({ sort })} onPeriod={period => view.update({ period })} onReset={view.reset} />
          </View>
        </View>}
        ListEmptyComponent={<Status title="No open holdings" message="Holdings added in Worthfolio will appear here." />}
        renderItem={({ item }) => <HoldingRow position={item} currency={data.account.baseCurrency} period={view.period} market={markets.get(item.symbol)?.data} quoteMarket={quotes.get(item.symbol)?.data}
          sortPrice={view.sort.startsWith('price') ? baseUnitPrice(item.lastPrice, item.currency, rates) : undefined} />} />}
  </View>;
}
const local = StyleSheet.create({
  header: { gap: spacing.small, marginBottom: spacing.tight },
});
