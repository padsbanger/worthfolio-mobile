import { useState } from 'react';
import { AssetRow, PortfolioOverview } from '../components/investment-ui';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useBootstrap, useData, usePortfolioRefresh } from '../api/data';
import type { Position } from '../api/contracts';
import { DataNotice, Label, RefreshHint, Status, styles } from '../components/ui';
import { money, number, positionValues, ticker, timestamp } from '../lib/format';
import { usePullRefresh } from '../components/use-pull-refresh';
import { colors, sizing, spacing } from '../theme/theme';

export function HoldingRow({ position, currency, showDetails = false }: { position: Position; currency: string; showDetails?: boolean }) {
  const values = positionValues(position, position.lastPrice, currency);
  const status = [values.value == null ? 'Valuation unavailable' : null,
    position.stale === true ? 'Stale' : null, position.cached === true ? 'Cached' : null,
    position.delayed === true ? 'Provider delayed' : null].filter(Boolean).join(' \u00b7 ');
  return <AssetRow symbol={ticker(position.symbol)} name={position.name || position.symbol}
    logoUrl={position.logoUrl} logoFallbackUrl={position.logoFallbackUrl}
    value={money(values.value, currency)} change={money(values.pnl, currency, true)} changeLabel={`Open P&L \u00b7 ${currency}`}
    direction={values.pnl == null ? undefined : values.pnl >= 0 ? 'positive' : 'negative'}
    subtitle={`${number(position.quantity)} units \u00b7 ${position.quantity < 0 ? 'Short' : 'Long'} \u00b7 ${money(position.lastPrice, position.currency)} / unit`}
    metadata={<>
      {!!status && <Text style={[styles.small, { color: colors.warning }]}>{status}</Text>}
      {showDetails && <View style={local.quoteDetails}>
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
  const pullRefresh = usePullRefresh(refresh.refresh);
  const [showDetails, setShowDetails] = useState(false);
  const data = result.data;
  const summary = data?.portfolioSummary;
  return <View style={styles.screen}><DataNotice />
    {!data ? <Status title={!online && !demo ? 'Connect to load your portfolio' : result.isError ? 'Portfolio unavailable' : 'Loading your portfolio'}
      message={result.error?.message} loading={result.isPending && (online || demo)} retry={result.isError && (online || demo) ? () => void refresh.refresh() : undefined} />
      : <FlatList data={data.positions} extraData={showDetails} keyExtractor={p => p.symbol} contentContainerStyle={styles.listContent}
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
            <Label>Value and open P&L in {data.account.baseCurrency}</Label>
          </View>
        </View>}
        ListEmptyComponent={<Status title="No open holdings" message="Holdings added in Worthfolio will appear here." />}
        renderItem={({ item }) => <HoldingRow position={item} currency={data.account.baseCurrency} showDetails={showDetails} />} />}
  </View>;
}
const local = StyleSheet.create({
  header: { gap: spacing.small, marginBottom: spacing.tight },
  freshness: { flexDirection: 'row', alignItems: 'center', gap: spacing.small, flexWrap: 'wrap' },
  detailsButton: { minHeight: sizing.touch, minWidth: sizing.touch, maxWidth: '45%', justifyContent: 'center' },
  detailsLabel: { ...styles.small, color: colors.accent },
  quoteDetails: { gap: 2, paddingTop: spacing.tight },
});
