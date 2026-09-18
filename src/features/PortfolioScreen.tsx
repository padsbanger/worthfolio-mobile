import { CompanyLogo } from '../components/CompanyLogo';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useBootstrap, useData, usePortfolioRefresh } from '../api/data';
import type { Position } from '../api/contracts';
import { Card, DataNotice, Heading, Label, RefreshHint, Status, styles } from '../components/ui';
import { money, number, positionValues, ticker, timestamp } from '../lib/format';
import { usePullRefresh } from '../components/use-pull-refresh';
import { colors } from '../theme/theme';

export function HoldingRow({ position, currency }: { position: Position; currency: string }) {
  const values = positionValues(position, position.lastPrice, currency);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${position.name || position.symbol}`}
    onPress={() => router.push({ pathname: '/instrument', params: { symbol: position.symbol } })}
    style={({ pressed }) => [local.holding, pressed && { backgroundColor: colors.surface }]}>
    <View style={local.asset}>
      <View style={[styles.row, { gap: 8 }]}><CompanyLogo symbol={position.symbol} logoUrl={position.logoUrl} logoFallbackUrl={position.logoFallbackUrl} />
        <Text style={[local.ticker, { flexShrink: 1 }]}>{ticker(position.symbol)}</Text></View>
      <Text style={styles.small}>{number(position.quantity)} units · {position.quantity < 0 ? 'Short' : 'Long'}</Text>
      <Text style={styles.small}>{money(position.lastPrice, position.currency)} / unit</Text>
    </View>
    <View style={local.value}>
      <Text style={styles.text}>{money(values.value, currency)}</Text>
      <Text style={{ color: values.pnl == null ? colors.muted : values.pnl >= 0 ? colors.positive : colors.negative }}>
        {money(values.pnl, currency, true)}
      </Text>
      <Text style={styles.small}>{position.quoteSource || 'Last known price'}</Text>
      <Text style={styles.small}>{timestamp(position.quoteRefreshedAt)}</Text>
    </View>
  </Pressable>;
}

export function PortfolioScreen() {
  const result = useBootstrap();
  const { online, demo } = useData();
  const refresh = usePortfolioRefresh();
  const pullRefresh = usePullRefresh(refresh.refresh);
  const data = result.data;
  const summary = data?.portfolioSummary;
  return <View style={styles.screen}><DataNotice />
    {!data ? <Status title={!online && !demo ? 'Connect to load your portfolio' : result.isError ? 'Portfolio unavailable' : 'Loading your portfolio'}
      message={result.error?.message} loading={result.isPending && (online || demo)} retry={result.isError && (online || demo) ? () => void refresh.refresh() : undefined} />
      : <FlatList data={data.positions} keyExtractor={p => p.symbol} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={pullRefresh.refreshing} enabled={online || demo} onRefresh={() => void pullRefresh.onRefresh()} tintColor={colors.accent} />}
        ListHeaderComponent={<View style={local.header}>
          <Label>{data.account.name}</Label>
          <Card>
            <Label>HOLDINGS VALUE · {summary!.currency}</Label>
            <Text adjustsFontSizeToFit numberOfLines={1} style={local.total}>{money(summary!.value, summary!.currency)}</Text>
            <Text style={[styles.text, { color: summary!.openPnl >= 0 ? colors.positive : colors.negative }]}>
              {money(summary!.openPnl, summary!.currency, true)} open P&L
            </Text>
            <View style={styles.divider} />
            <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
              <Label>Invested</Label><Text style={styles.text}>{money(summary!.invested, summary!.currency)}</Text>
            </View>
          </Card>
          <Text style={styles.small}>{summary!.pricedPositions} of {summary!.totalPositions} holdings valued · {summary!.coverage.toFixed(0)}% coverage{ '\n' }
            Quote time: {timestamp(summary!.asOf)}
          </Text>
          {summary!.coverage < 100 && <Text style={{ color: colors.warning }}>Partial valuation: some prices or currency conversions are unavailable.</Text>}
          {(result.isError || refresh.error) && <RefreshHint busy={refresh.refreshing}
            retry={online || demo ? () => void refresh.refresh() : undefined} />}
          <Heading>Your holdings</Heading>
          <Label>Value and open P&L in {data.account.baseCurrency}</Label>
        </View>}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListEmptyComponent={<Status title="No open holdings" message="Holdings added in Worthfolio will appear here." />}
        renderItem={({ item }) => <HoldingRow position={item} currency={data.account.baseCurrency} />} />}
  </View>;
}
const local = StyleSheet.create({
  header: { gap: 16, marginBottom: 12 }, total: { fontSize: 38, fontWeight: '700', color: colors.text, letterSpacing: -1 },
  holding: { minHeight: 106, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 10 },
  asset: { flex: 1, gap: 5 }, ticker: { fontWeight: '700', color: colors.text, fontSize: 17 },
  value: { flex: 1, alignItems: 'flex-end', gap: 5 },
});
