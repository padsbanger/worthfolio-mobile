import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { ReactNode } from 'react';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { CompanyLogo } from './CompanyLogo';
import { colors, shape, sizing, spacing, typography } from '../theme/theme';
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
  const { width, fontScale } = useWindowDimensions();
  const balanceText = money(displayedBalance, currency);
  const compact = width / fontScale < 360 || balanceText.length > 14;
  const tone = Number.isFinite(pnl) && pnl !== 0 ? colors[direction] : colors.muted;
  return <View style={local.overview}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs><LinearGradient id="portfolioGlow" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0" stopColor={colors.surface} /><Stop offset="1" stopColor={colors.accent} stopOpacity="0.13" />
        </LinearGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#portfolioGlow)" />
        {[64, 100, 136].map(radius => <Circle key={radius} cx="100%" cy="0" r={radius} fill="none" stroke={colors.accent} strokeOpacity="0.09" />)}
      </Svg>
    </View>
    <View style={local.overviewHeading}>
      <Text style={local.eyebrow}>PORTFOLIO VALUE</Text>
      <View style={local.currencyBadge}><Text style={local.currency}>{currency}</Text></View>
    </View>
    <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[local.balance, compact && local.compactBalance]}>{balanceText}</Text>
    <View style={local.metrics}>
      <View style={local.metric}>
        <Text style={local.label}>Open P&L</Text>
        <View style={[local.pnlBadge, { backgroundColor: `${tone}14` }]}>
          <Text accessible={false} importantForAccessibility="no" style={[local.pnlArrow, { color: tone }]}>{!Number.isFinite(pnl) || pnl === 0 ? '\u2014' : direction === 'positive' ? '\u2197' : '\u2198'}</Text>
          <Text style={[local.pnlValue, { color: tone }]}>{money(displayedPnl, currency, true)}</Text>
        </View>
      </View>
      <View style={local.metric}>
        <Text style={local.label}>Invested</Text>
        <Text style={local.invested}>{money(displayedInvested, currency)}</Text>
      </View>
    </View>
  </View>;
}

export function AssetRow({ symbol, name, logoUrl, logoFallbackUrl, value, change, changeLabel, hideChangeLabel = false, direction, subtitle, secondaryPrice, secondaryDescription, metadata, metadataDescription, onPress }: {
  symbol: string; name: string; logoUrl?: string | null; logoFallbackUrl?: string | null;
  value: string; change: string; changeLabel: string; hideChangeLabel?: boolean; direction?: 'positive' | 'negative'; subtitle: string; secondaryPrice?: ReactNode; secondaryDescription?: string; metadata?: ReactNode; metadataDescription?: string; onPress?: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width / fontScale < 300 || value.length > 16 || change.length > 16;
  const content = <>
    <View style={[local.assetTop, stacked && { flexWrap: 'wrap' }]}>
      <CompanyLogo symbol={symbol} logoUrl={logoUrl} logoFallbackUrl={logoFallbackUrl} size={sizing.logo} />
      <View style={local.identity}><Text style={local.name}>{name}</Text><Text style={local.label}>{symbol}</Text></View>
      <View style={[local.amount, stacked && local.stackedAmount]}><Text style={local.value}>{value}</Text>
        <Text style={[local.change, direction && { color: colors[direction] }]}>{change}</Text>
        {secondaryPrice}
        {!hideChangeLabel && <Text style={local.caption}>{changeLabel}</Text>}
      </View>
    </View>
    <Text style={local.caption}>{subtitle}</Text>
    {metadata}
  </>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`}
    accessibilityHint={[`${symbol}.`, `Value ${value}.`, `${changeLabel} ${change}.`, secondaryDescription, `${subtitle}.`, metadataDescription, 'Opens instrument details.'].filter(Boolean).join(' ')}
    onPress={onPress} style={({ pressed }) => [local.asset, pressed && { backgroundColor: colors.surface }]}>{content}</Pressable>
    : <View style={local.asset}>{content}</View>;
}

const local = StyleSheet.create({
  overview: { gap: spacing.small, padding: spacing.screen, marginBottom: spacing.small, borderRadius: shape.card + 4, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  overviewHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.small },
  eyebrow: { ...typography.caption, fontWeight: '600', letterSpacing: 1.5, color: colors.muted },
  currencyBadge: { paddingHorizontal: spacing.small, paddingVertical: 2, borderRadius: 6, backgroundColor: `${colors.accent}14` },
  currency: { ...typography.caption, fontWeight: '600', color: colors.accent },
  balance: { ...typography.balance, fontSize: 44, lineHeight: 54, color: colors.text, marginBottom: spacing.small },
  compactBalance: { fontSize: 34, lineHeight: 42 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.section, paddingTop: spacing.section, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pnlBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.tight, paddingHorizontal: spacing.small, paddingVertical: 2, borderRadius: 8 },
  pnlArrow: { ...typography.label, fontWeight: '600' },
  pnlValue: { ...typography.metric, fontSize: 15, lineHeight: 22, flexShrink: 1, fontVariant: ['tabular-nums'] },
  invested: { ...typography.label, paddingVertical: spacing.tight, fontVariant: ['tabular-nums'], color: colors.muted },
  metric: { flexGrow: 1, flexBasis: 130, gap: spacing.tight },
  label: { ...typography.label, color: colors.muted },
  caption: { ...typography.caption, color: colors.muted },
  value: { ...typography.metric, color: colors.text, textAlign: 'right' },
  change: { ...typography.label, fontVariant: ['tabular-nums'], color: colors.muted, textAlign: 'right' },
  asset: { minHeight: sizing.touch, paddingVertical: 10, gap: spacing.tight, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  assetTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.small },
  identity: { flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: 2, paddingTop: 1 },
  name: { ...typography.body, fontWeight: '600', color: colors.text },
  amount: { flexShrink: 1, minWidth: 104, alignItems: 'flex-end', gap: 1 },
  stackedAmount: { flexBasis: '100%', flexGrow: 0, alignItems: 'flex-end', paddingTop: spacing.tight },
});
