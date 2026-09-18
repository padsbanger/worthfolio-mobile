import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { ReactNode } from 'react';
import { CompanyLogo } from './CompanyLogo';
import { colors, sizing, spacing, typography } from '../theme/theme';
import { money } from '../lib/format';
import { useCountedNumber } from './use-counted-number';

export function Metric({ label, value, direction }: { label: string; value: string; direction?: 'positive' | 'negative' }) {
  return <View style={local.metric}>
    <Text style={local.label}>{label}</Text>
    <Text style={[local.value, direction && { color: colors[direction] }]}>{value}</Text>
  </View>;
}

export function PortfolioOverview({ balance, currency, pnl, invested, direction }: {
  balance: number; currency: string; pnl: number; invested: number; direction: 'positive' | 'negative';
}) {
  const displayedBalance = useCountedNumber(balance);
  const displayedPnl = useCountedNumber(pnl);
  const displayedInvested = useCountedNumber(invested);
  return <View style={local.overview}>
    <Text style={local.balance}>{money(displayedBalance, currency)}</Text>
    <View style={local.metrics}><Metric label="Open P&L" value={money(displayedPnl, currency, true)} direction={direction} /><Metric label="Invested" value={money(displayedInvested, currency)} /></View>
  </View>;
}

export function AssetRow({ symbol, name, logoUrl, logoFallbackUrl, value, change, changeLabel, hideChangeLabel = false, direction, subtitle, secondaryPrice, secondaryDescription, metadata, onPress }: {
  symbol: string; name: string; logoUrl?: string | null; logoFallbackUrl?: string | null;
  value: string; change: string; changeLabel: string; hideChangeLabel?: boolean; direction?: 'positive' | 'negative'; subtitle: string; secondaryPrice?: ReactNode; secondaryDescription?: string; metadata?: ReactNode; onPress?: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width / fontScale < 300 || value.length > 16 || change.length > 16;
  const content = <>
    <View style={[local.assetTop, stacked && { flexWrap: 'wrap' }]}>
      <CompanyLogo symbol={symbol} logoUrl={logoUrl} logoFallbackUrl={logoFallbackUrl} size={sizing.logo} />
      <View style={local.identity}><Text numberOfLines={1} ellipsizeMode="tail" style={local.name}>{name}</Text><Text numberOfLines={1} style={local.label}>{symbol}</Text></View>
      <View style={[local.amount, stacked && local.stackedAmount]}><Text style={local.value}>{value}</Text>
        <Text style={[local.change, direction && { color: colors[direction] }]}>{change}</Text>
        {secondaryPrice}
        {!hideChangeLabel && <Text style={local.caption}>{changeLabel}</Text>}
      </View>
    </View>
    <Text numberOfLines={1} ellipsizeMode="tail" style={local.caption}>{subtitle}</Text>
  </>;
  return <View style={local.asset}>
    {onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`}
      accessibilityHint={[`${symbol}.`, `Value ${value}.`, `${changeLabel} ${change}.`, secondaryDescription, `${subtitle}.`, 'Opens instrument details.'].filter(Boolean).join(' ')}
      onPress={onPress} style={({ pressed }) => [local.assetAction, pressed && { backgroundColor: colors.surface }]}>{content}</Pressable>
      : content}
    {metadata}
  </View>;
}

const local = StyleSheet.create({
  overview: { gap: spacing.tight, paddingVertical: spacing.small },
  balance: { ...typography.balance, color: colors.text },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.screen, paddingTop: spacing.small },
  metric: { flexGrow: 1, flexBasis: 130, gap: spacing.tight },
  label: { ...typography.label, color: colors.muted },
  caption: { ...typography.caption, color: colors.muted },
  value: { ...typography.metric, color: colors.text },
  change: { ...typography.label, fontVariant: ['tabular-nums'], color: colors.muted },
  asset: { minHeight: sizing.touch, paddingVertical: 10, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  assetAction: { minHeight: sizing.touch, gap: spacing.tight },
  assetTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.small },
  identity: { flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: 2, paddingTop: 1 },
  name: { ...typography.body, fontWeight: '600', color: colors.text },
  amount: { flexShrink: 1, minWidth: 104, alignItems: 'flex-end', gap: 1 },
  stackedAmount: { flexBasis: '100%', flexGrow: 0, alignItems: 'flex-end', paddingTop: spacing.tight },
});
