import { CompanyLogo } from '../components/CompanyLogo';
import { useState } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chartRanges, type ChartRange } from '../api/contracts';
import { useBootstrap, useData, useMarket } from '../api/data';
import { Card, DataNotice, Heading, Label, RefreshHint, Status, styles } from '../components/ui';
import { PriceChart } from '../components/PriceChart';
import { money, number, percent, positionValues, ticker, timestamp } from '../lib/format';
import { colors } from '../theme/theme';

export function InstrumentScreen() {
  const params = useLocalSearchParams<{ symbol?: string }>();
  const symbol = typeof params.symbol === 'string' ? params.symbol : '';
  return <InstrumentDetails key={symbol} symbol={symbol} />;
}

function InstrumentDetails({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRange>('1M');
  const bootstrap = useBootstrap();
  const result = useMarket(symbol, range, bootstrap.data?.marketData?.selectedRefreshSeconds ?? null);
  const { online, demo, active } = useData();
  const insets = useSafeAreaInsets();
  const data = result.data;
  const position = bootstrap.data?.positions.find(p => p.symbol === symbol);
  const change = data?.lastPrice != null && data.previousClose != null && data.previousClose > 0 ? (data.lastPrice / data.previousClose - 1) * 100 : null;
  // A provider's currency change must not reinterpret the holding's cost basis/FX.
  const values = position ? positionValues(position, data?.currency === position.currency ? data.lastPrice ?? position.lastPrice : position.lastPrice, bootstrap.data?.account.baseCurrency) : null;
  if (!symbol) return <View style={styles.screen}><Status title="Instrument unavailable" message="Go back and select an instrument." /></View>;
  return <View style={styles.screen}><Stack.Screen options={{ title: ticker(symbol) }} /><DataNotice />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 36 + insets.bottom }]}>
      <View style={styles.row}>
        <CompanyLogo symbol={symbol} logoUrl={data?.logoUrl ?? position?.logoUrl} logoFallbackUrl={data?.logoFallbackUrl ?? position?.logoFallbackUrl} size={40} />
        <View style={{ flex: 1 }}><Label>{symbol}</Label><Heading>{data?.name || ticker(symbol)}</Heading></View>
      </View>
      <Text style={{ fontSize: 38, color: colors.text, fontWeight: '700' }}>{money(data?.lastPrice, data?.currency)}</Text>
      <Text style={{ color: change == null ? colors.muted : change >= 0 ? colors.positive : colors.negative }}>{percent(change)} today</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {chartRanges.map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${item} price history`} accessibilityState={{ selected: range === item }}
          onPress={() => setRange(item)} style={{ minWidth: 48, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
            backgroundColor: range === item ? colors.accent : colors.surface }}>
          <Text style={{ color: range === item ? colors.background : colors.text, fontWeight: '600' }}>{item}</Text>
        </Pressable>)}
      </ScrollView>
      <Card>{data ? <PriceChart key={`${symbol}:${range}`} observations={data.candles} currency={data.currency} /> :
        <Status title={result.isFetching ? 'Loading price history' : 'Price history unavailable'} loading={result.isFetching}
          message={result.error?.message} retry={result.isError && (demo || (online && active)) ? () => void result.refetch({ cancelRefetch: false }) : undefined} />}</Card>
      {range === 'ALL' && <Text style={styles.small}>Available provider history; the dates shown may not cover the instrument’s full lifetime.</Text>}
      {data && result.isError && <RefreshHint busy={result.isFetching} retry={demo || (online && active) ? () => void result.refetch({ cancelRefetch: false }) : undefined} />}
      {data && <Text style={styles.small}>{data.source}{data.delayed ? ' · Provider delayed' : ''}{data.cached ? ' · Cached' : ''}{ '\n' }Fetched: {timestamp(data.refreshedAt)}</Text>}
      {position && <Card><Heading>Your position</Heading><Label>{number(position.quantity)} units · {position.quantity < 0 ? 'Short' : 'Long'}</Label>
        <Text style={styles.text}>Value {money(values?.value, bootstrap.data?.account.baseCurrency)}</Text>
        <Text style={styles.text}>Open P&L {money(values?.pnl, bootstrap.data?.account.baseCurrency, true)}</Text>
        <Label>Average entry {money(position.avgPrice, position.currency)}</Label>
      </Card>}
    </ScrollView>
  </View>;
}
