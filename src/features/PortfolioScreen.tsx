import { useState } from 'react';
import { AssetRow, PortfolioOverview } from '../components/investment-ui';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useBootstrap, useData, useListMarkets, usePortfolioRefresh } from '../api/data';
import type { Market, Position } from '../api/contracts';
import { DataNotice, Label, RefreshHint, Status, styles } from '../components/ui';
import { money, number, percent, positionValues, ticker, timestamp } from '../lib/format';
import { usePullRefresh } from '../components/use-pull-refresh';
import { ExtendedQuote } from '../components/ExtendedQuote';
import { ListControls } from '../components/ListControls';
import { useListPreferences } from './list-preferences';
import { baseUnitPrice, periodChange, periodLabel, priceRates, sortAssets, type ListPeriod } from '../lib/list-view';
import { colors, sizing, spacing } from '../theme/theme';

export function HoldingRow({ position, currency, showDetails = false, period, market, quoteMarket = market, marketError, sortPrice }: { position: Position; currency: string; showDetails?: boolean; period?: ListPeriod; market?: Market; quoteMarket?: Market; marketError?: boolean; sortPrice?: number | null }) {
  const values = positionValues(position, position.lastPrice, currency);
  const change = period ? periodChange(market, period) : null;
  const direction = period ? change?.value : values.pnl;
  const status = [marketError ? 'Update delayed' : null,
    market?.cached ? 'Cached change' : null, market?.delayed ? 'Change provider delayed' : null, values.value == null ? 'Valuation unavailable' : null,
    position.stale === true ? 'Stale' : null, position.cached === true ? 'Cached' : null,
    position.delayed === true ? 'Provider delayed' : null].filter(Boolean).join(' \u00b7 ');
  return <AssetRow hideChangeLabel={!!period} symbol={ticker(position.symbol)} name={position.name || position.symbol}
    logoUrl={position.logoUrl} logoFallbackUrl={position.logoFallbackUrl}
    value={money(values.value, currency)} change={period ? percent(change?.value ?? null) : money(values.pnl, currency, true)} changeLabel={period ? periodLabel(period) : `Open P&L \u00b7 ${currency}`}
    direction={direction == null ? undefined : direction >= 0 ? 'positive' : 'negative'}
    subtitle={`${number(position.quantity)} units \u00b7 ${position.quantity < 0 ? 'Short' : 'Long'} \u00b7 ${money(position.lastPrice, position.currency)} / unit`}
    secondaryPrice={<ExtendedQuote market={quoteMarket} />}
    metadata={<>
      {period && <Text style={styles.small}>Open P&amp;L {money(values.pnl, currency, true)}</Text>}
      {sortPrice !== undefined && <Text style={styles.small}>Sort price: {money(sortPrice, currency)}</Text>}
      {!showDetails && (values.value == null || position.stale === true) && <Text style={[styles.small, { color: colors.warning }]}>{[values.value == null ? 'Valuation unavailable' : null, position.stale === true ? 'Stale' : null].filter(Boolean).join(' \u00b7 ')}</Text>}
      {showDetails && <View style={local.quoteDetails}>
        <ExtendedQuote market={quoteMarket} details />
        {!!status && <Text style={[styles.small, { color: colors.warning }]}>{status}</Text>}
        {period && <>
          <Text style={styles.small}>Change source: {market?.source || 'Unavailable'} / {timestamp(market?.refreshedAt)}</Text>
          <Text style={styles.small}>{change?.from ? `Observed: ${timestamp(change.from, true)} to ${timestamp(change.to, true)}` : period === '1D' ? 'Change from previous close' : 'Insufficient observations for this period'}</Text>
        </>}
        <Text style={styles.small}>Source: {position.quoteSource || 'Last known price'}</Text>
        <Text style={styles.small}>Quote time: {position.quoteRefreshedAt || 'Time unavailable'}</Text>
        <Text style={styles.small}>Quote currency: {position.currency} / Values in {currency}</Text>
      </View>}
    </>}
    onPress={() => router.push({ pathname: '/instrument', params: { symbol: position.symbol } })} />;
}

export function PortfolioScreen() {
  const result = useBootstrap();
  const { online, demo } = useData();
  const refresh = usePortfolioRefresh();

  const [showDetails, setShowDetails] = useState(false);
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
    {!data ? <Status title={!online && !demo ? 'Connect to load your portfolio' : result.isError ? 'Portfolio unavailable' : 'Loading your portfolio'}
      message={result.error?.message} loading={result.isPending && (online || demo)} retry={result.isError && (online || demo) ? () => void refresh.refresh() : undefined} />
      : <FlatList key={`${view.sort}:${view.period}`} data={positions} extraData={showDetails} keyExtractor={p => p.symbol} contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={pullRefresh.refreshing} enabled={online || demo} onRefresh={() => void pullRefresh.onRefresh()} tintColor={colors.accent} />}
        ListHeaderComponent={<View style={local.header}>
          <PortfolioOverview account={data.account.name} balance={money(summary!.value, summary!.currency)} currency={summary!.currency}
            pnl={money(summary!.openPnl, summary!.currency, true)} invested={money(summary!.invested, summary!.currency)}
            direction={summary!.openPnl >= 0 ? 'positive' : 'negative'} />
          <View style={local.freshness}>
            <View style={{ flex: 1 }}>
              <Text style={styles.small}>{summary!.pricedPositions} of {summary!.totalPositions} holdings valued / {summary!.coverage.toFixed(0)}% coverage</Text>
              <Text style={styles.small}>Quote time: {timestamp(summary!.asOf)}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Quote details" accessibilityState={{ expanded: showDetails }}
              onPress={() => setShowDetails(value => !value)} style={local.detailsButton}>
              <Text style={local.detailsLabel}>{showDetails ? 'Hide details' : 'Quote details'}</Text>
            </Pressable>
          </View>
          {showDetails && <Text style={styles.small}>Summary timestamp: {summary!.asOf || 'Time unavailable'}. Each holding has its own quote timestamp below.</Text>}
          {summary!.coverage < 100 && <Text style={[styles.small, { color: colors.warning }]}>Partial valuation: some prices or currency conversions are unavailable.</Text>}
          {(result.isError || refresh.error) && <RefreshHint busy={refresh.refreshing}
            retry={online || demo ? () => void refresh.refresh() : undefined} />}
          <View style={styles.divider} />
          <View style={{ gap: spacing.tight }}>
            <Text accessibilityRole="header" style={styles.sectionHeading}>Your holdings</Text>
            <Label>Value in {data.account.baseCurrency} / Price change %</Label>
            <ListControls sort={view.sort} period={view.period} currency={currency} loading={[...markets.values()].some(m => m.isFetching && !m.data)} onSort={sort => view.update({ sort })} onPeriod={period => view.update({ period })} />
          </View>
        </View>}
        ListEmptyComponent={<Status title="No open holdings" message="Holdings added in Worthfolio will appear here." />}
        renderItem={({ item }) => <HoldingRow position={item} currency={data.account.baseCurrency} showDetails={showDetails} period={view.period} market={markets.get(item.symbol)?.data} quoteMarket={quotes.get(item.symbol)?.data} marketError={markets.get(item.symbol)?.isError}
          sortPrice={view.sort.startsWith('price') ? baseUnitPrice(item.lastPrice, item.currency, rates) : undefined} />} />}
  </View>;
}
const local = StyleSheet.create({
  header: { gap: spacing.small, marginBottom: spacing.tight },
  freshness: { flexDirection: 'row', alignItems: 'center', gap: spacing.small, flexWrap: 'wrap' },
  detailsButton: { minHeight: sizing.touch, minWidth: sizing.touch, maxWidth: '45%', justifyContent: 'center' },
  detailsLabel: { ...styles.small, color: colors.accent },
  quoteDetails: { gap: 2, paddingTop: spacing.tight },
});
