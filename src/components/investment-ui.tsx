import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CompanyLogo } from './CompanyLogo';
import { colors, sizing, spacing, typography } from '../theme/theme';

export function Metric({ label, value, direction }: { label: string; value: string; direction?: 'positive' | 'negative' }) {
  return <View style={local.metric}>
    <Text style={local.label}>{label}</Text>
    <Text style={[local.value, direction && { color: colors[direction] }]}>{value}</Text>
  </View>;
}

export function PortfolioOverview({ account, balance, currency, pnl, invested, direction }: {
  account: string; balance: string; currency: string; pnl: string; invested: string; direction: 'positive' | 'negative';
}) {
  return <View style={local.overview}>
    <Text style={local.label}>{account}</Text>
    <Text style={local.label}>Holdings value · {currency}</Text>
    <Text style={local.balance}>{balance}</Text>
    <View style={local.metrics}><Metric label="Open P&L" value={pnl} direction={direction} /><Metric label="Invested" value={invested} /></View>
  </View>;
}

export function AssetRow({ symbol, name, logoUrl, logoFallbackUrl, value, change, changeLabel, direction, subtitle, onPress }: {
  symbol: string; name: string; logoUrl?: string | null; logoFallbackUrl?: string | null;
  value: string; change: string; changeLabel: string; direction?: 'positive' | 'negative'; subtitle: string; onPress?: () => void;
}) {
  const content = <>
    <View style={local.assetTop}>
      <CompanyLogo symbol={symbol} logoUrl={logoUrl} logoFallbackUrl={logoFallbackUrl} size={sizing.logo} />
      <View style={local.identity}><Text style={local.name}>{name}</Text><Text style={local.label}>{symbol}</Text></View>
      <View style={local.amount}><Text style={local.value}>{value}</Text>
        <Text style={[local.change, direction && { color: colors[direction] }]}>{change}</Text>
        <Text style={local.caption}>{changeLabel}</Text>
      </View>
    </View>
    <Text style={local.caption}>{subtitle}</Text>
  </>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`}
    onPress={onPress} style={({ pressed }) => [local.asset, pressed && { backgroundColor: colors.surface }]}>{content}</Pressable>
    : <View style={local.asset}>{content}</View>;
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
  asset: { minHeight: sizing.touch, paddingVertical: spacing.section, gap: spacing.tight, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  assetTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
  identity: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: '600', color: colors.text },
  amount: { flex: 1, alignItems: 'flex-end', gap: 2 },
});
