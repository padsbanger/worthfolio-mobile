import { CompanyLogo } from '../components/CompanyLogo';
import { useState } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chartRanges, type ChartRange } from '../api/contracts';
import { useBootstrap, useData, useMarket } from '../api/data';
import { DataNotice, Heading, Label, Status, styles } from '../components/ui';
import { PriceChart } from '../components/PriceChart';
import { money, number, percent, positionValues, ticker, timestamp } from '../lib/format';
import { Metric } from '../components/investment-ui';
import { colors, sizing, spacing, typography } from '../theme/theme';

export function InstrumentScreen() {
  const params = useLocalSearchParams<{ symbol?: string }>();
  const symbol = typeof params.symbol === 'string' ? params.symbol : '';
  return <InstrumentDetails key={symbol} symbol={symbol} />;
}

function InstrumentDetails({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRange>('1M');
  const [showDetails, setShowDetails] = useState(false);
  const bootstrap = useBootstrap();
  const result = useMarket(symbol, range, bootstrap.data?.marketData?.selectedRefreshSeconds ?? null);
  const { online, demo, active } = useData();
  const insets = useSafeAreaInsets();
  const data = result.data;
  const position = bootstrap.data?.positions.find(p => p.symbol === symbol);
  const trades = bootstrap.data?.trades.filter(trade => trade.symbol === symbol) ?? [];
  const change = data?.lastPrice != null && data.previousClose != null && data.previousClose > 0 ? (data.lastPrice / data.previousClose - 1) * 100 : null;
  // A provider's currency change must not reinterpret the holding's cost basis/FX.
  const values = position ? positionValues(position, data?.currency === position.currency ? data.lastPrice ?? position.lastPrice : position.lastPrice, bootstrap.data?.account.baseCurrency) : null;
  if (!symbol) return <View style={styles.screen}><Status title="Instrument unavailable" message="Go back and select an instrument." /></View>;
  return <View style={styles.screen}><Stack.Screen options={{ title: ticker(symbol) }} /><DataNotice refreshError={!!data && result.isError} busy={result.isFetching}
    retry={demo || (online && active) ? () => void result.refetch({ cancelRefetch: false }) : undefined} />
    <ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: spacing.bottom + insets.bottom }]}>
      <View style={styles.row}>
        <CompanyLogo symbol={symbol} logoUrl={data?.logoUrl ?? position?.logoUrl} logoFallbackUrl={data?.logoFallbackUrl ?? position?.logoFallbackUrl} size={40} />
        <View style={{ flex: 1 }}><Label>{symbol}</Label><Heading>{data?.name || position?.name || ticker(symbol)}</Heading></View>
      </View>
      <View style={local.priceSection}>
      <View style={local.priceSummary}>
      <Text style={styles.small}>Price</Text>
      <Text style={local.price}>{money(data?.lastPrice, data?.currency)}</Text>
      <Text style={[styles.label, { color: change == null ? colors.muted : change >= 0 ? colors.positive : colors.negative }]}>{percent(change)} daily change</Text>
      <Text style={styles.small}>{data?.currency === 'GBX' ? 'GBP · converted from GBX' : data?.currency || 'Currency unavailable'}</Text>
      </View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.ranges}>
        {chartRanges.map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${item} price history`} accessibilityState={{ selected: range === item }}
          onPress={() => setRange(item)} style={({ pressed }) => [local.range, range === item && local.selectedRange, pressed && local.pressed]}>
          <Text style={[local.rangeText, range === item && { color: colors.accent }]}>{item}</Text></Pressable>)}
      </ScrollView>
      <View>{data ? <PriceChart key={`${symbol}:${range}`} observations={data.candles} currency={data.currency} trades={trades} /> :
        <Status title={result.isFetching ? 'Loading price history' : 'Price history unavailable'} loading={result.isFetching}
          message={result.error?.message} retry={result.isError && (demo || (online && active)) ? () => void result.refetch({ cancelRefetch: false }) : undefined} />}</View>
      {range === 'ALL' && <Text style={styles.small}>Available provider history; the dates shown may not cover the instrument’s full lifetime.</Text>}
      {data && <View style={local.quoteDetails}>
        <Text style={local.sectionHeading}>Quote details</Text>
        <View style={local.metadataHeader}>
          <View style={local.freshness}>
            <Text style={styles.small}>{timestamp(data.refreshedAt)}</Text>
            {(data.stale || data.delayed || data.cached) && <Text style={[styles.small, { color: colors.warning }]}>
              {[data.stale && 'Stale', data.delayed && 'Provider delayed', data.cached && 'Cached'].filter(Boolean).join(' \u00b7 ')}
            </Text>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Quote details" accessibilityState={{ expanded: showDetails }}
            onPress={() => setShowDetails(value => !value)} style={({ pressed }) => [local.detailsButton, pressed && local.pressed]}>
            <Text style={[styles.small, { color: colors.accent }]}>{showDetails ? 'Hide details' : 'Show details'}</Text>
          </Pressable>
        </View>
        {showDetails && <View style={{ gap: spacing.tight }}>
          <Text style={styles.small}>Source: {data.source || 'Unavailable'}</Text>
          <Text style={styles.small}>Fetched: {data.refreshedAt || 'Time unavailable'}</Text>
          <Text style={styles.small}>Previous close: {money(data.previousClose, data.currency)}</Text>
        </View>}
      </View>}
      {position && <View style={local.position}>
        <Text style={styles.sectionHeading}>Your position</Text>
        <Label>{number(position.quantity)} units · {position.quantity < 0 ? 'Short' : 'Long'}</Label>
        <View style={local.metrics}>
          <Metric label={`Value · ${bootstrap.data?.account.baseCurrency}`} value={money(values?.value, bootstrap.data?.account.baseCurrency)} />
          <Metric label="Open P&L" value={money(values?.pnl, bootstrap.data?.account.baseCurrency, true)}
            direction={values?.pnl == null ? undefined : values.pnl >= 0 ? 'positive' : 'negative'} />
          <Metric label="Average entry" value={money(position.avgPrice, position.currency)} />
        </View>
      </View>}
    </ScrollView>
  </View>;
}

const local = StyleSheet.create({
  price: { ...typography.balance, color: colors.text },
  sectionHeading: { ...typography.section, color: colors.text },
  priceSection: { gap: spacing.small },
  priceSummary: { gap: 2 },
  ranges: { flexGrow: 1, justifyContent: 'space-between', gap: spacing.tight, padding: spacing.tight, borderRadius: 14, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  range: { minWidth: sizing.touch, minHeight: sizing.touch, paddingHorizontal: spacing.small, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  selectedRange: { backgroundColor: `${colors.accent}1F`, borderWidth: StyleSheet.hairlineWidth, borderColor: `${colors.accent}66` },
  rangeText: { ...typography.label, fontWeight: '600', color: colors.muted },
  pressed: { opacity: 0.72 },
  quoteDetails: { gap: spacing.tight, paddingTop: spacing.section, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  metadataHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
  freshness: { flex: 1, gap: spacing.tight },
  detailsButton: { minHeight: sizing.touch, minWidth: sizing.touch, justifyContent: 'center' },
  position: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.section, gap: spacing.small },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.screen },
});
