import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AssetRow, PortfolioOverview } from '../components/investment-ui';
import { Button, Card, Heading, Label, styles } from '../components/ui';
import { sampleBootstrap } from '../fixtures/portfolio';
import { money, number, positionValues, ticker } from '../lib/format';
import { colors, spacing } from '../theme/theme';

/** Static review fixtures: never bind this screen to an account or market query. */
export function DesignPreviewScreen() {
  const [details, setDetails] = useState(false);
  const insets = useSafeAreaInsets();
  const { account, portfolioSummary: summary, positions } = sampleBootstrap;
  return <View style={styles.screen}>
    <View style={styles.notice}><Text style={styles.noticeText}>SAMPLE DATA · Design preview</Text></View>
    <ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: spacing.bottom + insets.bottom }]}>
      <PortfolioOverview balance={money(summary.value, summary.currency)}
        pnl={money(summary.openPnl, summary.currency, true)} invested={money(summary.invested, summary.currency)} direction="positive" />
      <View style={styles.divider} />
      <View style={{ gap: spacing.tight }}><Heading>Holdings</Heading><Label>Value and open P&L · USD</Label></View>
      <View>{positions.map(position => {
        const values = positionValues(position, position.lastPrice, account.baseCurrency);
        return <AssetRow key={position.symbol} symbol={ticker(position.symbol)} name={position.name || position.symbol}
          value={money(values.value, account.baseCurrency)} change={money(values.pnl, account.baseCurrency, true)} changeLabel="Open P&L"
          direction={values.pnl == null ? undefined : values.pnl >= 0 ? 'positive' : 'negative'}
          subtitle={`${number(position.quantity)} units · ${money(position.lastPrice, position.currency)} / unit`} />;
      })}</View>
      <Text style={styles.small}>3 of 3 holdings valued · 100% coverage</Text>
      <Button title={details ? 'Hide sample quote details' : 'Sample quote details'} secondary onPress={() => setDetails(value => !value)} />
      {details && <Card style={styles.compactCard}><Label>Development fixture · Sep 16, 2026, 16:00 UTC</Label>
        <Text style={styles.small}>Static sample prices for visual review. No live account values or market requests are used by this preview.</Text></Card>}
      <Text style={[styles.small, { color: colors.muted }]}>Shared Portfolio layout reference.</Text>
    </ScrollView>
  </View>;
}
