import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { PropsWithChildren } from 'react';
import { colors, shape, sizing, spacing, typography } from '../theme/theme';
import { useData } from '../api/data';

export function Heading({ children }: PropsWithChildren) { return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>; }
export function Label({ children }: PropsWithChildren) { return <Text style={styles.label}>{children}</Text>; }
export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) { return <View style={[styles.card, style]}>{children}</View>; }
export function Button({ title, onPress, secondary, disabled }: { title: string; onPress(): void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && { opacity: 0.6 }]}>
    <Text style={[styles.buttonText, secondary && { color: colors.text }]}>{title}</Text>
  </Pressable>;
}
export function Status({ title, message, retry, loading }: { title: string; message?: string; retry?: () => void; loading?: boolean }) {
  return <View style={styles.status} accessibilityLiveRegion="polite">
    {loading && <ActivityIndicator color={colors.accent} size="large" />}
    <Text style={styles.statusTitle}>{title}</Text>
    {message && <Text style={styles.description}>{message}</Text>}
    {retry && <Button title="Try again" onPress={retry} secondary />}
  </View>;
}
/** Static placeholders reserve the same visual structure until a first real quote arrives. */
export function AssetRowSkeleton({ label = 'Loading quote' }: { label?: string }) {
  return <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} style={styles.assetSkeleton}>
    <View style={styles.skeletonTop}>
      <View style={styles.skeletonLogo} />
      <View style={styles.skeletonIdentity}><View style={[styles.skeletonLine, { width: '82%' }]} /><View style={[styles.skeletonLine, { width: '42%' }]} /></View>
      <View style={styles.skeletonAmount}><View style={[styles.skeletonLine, { width: '76%' }]} /><View style={[styles.skeletonLine, { width: '46%' }]} /></View>
    </View>
    <View style={[styles.skeletonLine, { width: '62%' }]} />
  </View>;
}
export function ListSkeleton({ label, rows = 3, overview = false }: { label: string; rows?: number; overview?: boolean }) {
  return <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} style={styles.skeletonContent}>
    {overview && <View style={styles.skeletonOverview}><View style={[styles.skeletonLine, { width: '35%' }]} /><View style={[styles.skeletonLine, { width: '82%', height: 50 }]} /><View style={styles.skeletonMetrics}>{[0, 1].map(index => <View key={index} style={styles.skeletonIdentity}><View style={[styles.skeletonLine, { width: '50%' }]} /><View style={[styles.skeletonLine, { width: '85%', height: 24 }]} /></View>)}</View></View>}
    {Array.from({ length: rows }, (_, index) => <AssetRowSkeleton key={index} label={`${label}, row ${index + 1}`} />)}
  </View>;
}
export function DataNotice({ refreshError = false, retry, busy = false }: { refreshError?: boolean; retry?: () => void; busy?: boolean }) {
  const { demo, online } = useData();
  const message = !online ? 'Offline · Showing loaded data when available' : refreshError ? 'Updates delayed'
    : demo ? 'SAMPLE DATA · Development preview' : null;
  if (!message) return null;
  return <View style={styles.notice} accessibilityLiveRegion="polite"><Text style={styles.noticeText}>{message}</Text>
    {refreshError && retry && online && <Pressable accessibilityRole="button" accessibilityLabel="Retry refresh"
      accessibilityState={{ disabled: busy }} disabled={busy} onPress={retry} style={styles.noticeRetry}>
      <Text style={styles.noticeRetryText}>{busy ? 'Retrying…' : 'Retry'}</Text>
    </Pressable>}
  </View>;
}
export function RefreshHint({ retry, busy }: { retry?: () => void; busy?: boolean }) {
  return <View style={styles.refreshHint}>
    <Text style={[styles.small, { flex: 1 }]}>Updates delayed</Text>
    {retry && <Pressable accessibilityRole="button" accessibilityLabel="Retry refresh"
      accessibilityState={{ disabled: !!busy }} disabled={busy} onPress={retry} style={styles.refreshRetry}>
      <Text style={styles.refreshRetryText}>{busy ? 'Retrying…' : 'Retry'}</Text>
    </Pressable>}
  </View>;
}
export const styles = StyleSheet.create({
  refreshHint: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshRetry: { minHeight: sizing.touch, minWidth: sizing.touch, justifyContent: 'center', alignItems: 'flex-end' },
  refreshRetryText: { color: colors.accent, fontSize: 12, lineHeight: 18 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18, paddingBottom: 36 },
  // Lists own row padding; a container gap would also pad both sides of separators.
  listContent: { padding: spacing.screen, paddingTop: spacing.section, paddingBottom: spacing.bottom },
  detailContent: { padding: spacing.screen, gap: spacing.section, paddingBottom: spacing.bottom },
  sectionHeading: { ...typography.section, color: colors.text },
  compactCard: { padding: spacing.screen, gap: spacing.small },
  heading: { ...typography.title, color: colors.text },
  label: { ...typography.label, color: colors.muted },
  text: { ...typography.body, color: colors.text, fontVariant: ['tabular-nums'] },
  small: { ...typography.caption, color: colors.muted, fontVariant: ['tabular-nums'] },
  card: { padding: 20, borderRadius: shape.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  button: { minHeight: sizing.touch, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: colors.accent, borderRadius: shape.control, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.elevated },
  buttonText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  status: { padding: 28, gap: 16, alignItems: 'center' },
  statusTitle: { color: colors.text, fontSize: 19, fontWeight: '600', textAlign: 'center' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  notice: { minHeight: sizing.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.small, backgroundColor: colors.elevated, paddingLeft: spacing.screen, paddingRight: spacing.tight },
  noticeText: { flex: 1, color: colors.warning, fontSize: 12, lineHeight: 18 },
  noticeRetry: { minHeight: sizing.touch, minWidth: sizing.touch, alignItems: 'center', justifyContent: 'center' },
  noticeRetryText: { color: colors.accent, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { height: 1, backgroundColor: colors.border },
  input: { backgroundColor: colors.surface, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: shape.control, paddingHorizontal: 16, minHeight: 52, fontSize: 16 },
  skeletonContent: { padding: spacing.screen, paddingTop: spacing.section, paddingBottom: spacing.bottom, gap: spacing.tight },
  skeletonOverview: { padding: spacing.screen, gap: spacing.section, marginBottom: spacing.small, borderRadius: shape.card + 4, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  skeletonMetrics: { flexDirection: 'row', gap: spacing.section, paddingTop: spacing.section, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  assetSkeleton: { minHeight: 72, paddingVertical: 10, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  skeletonTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.small },
  skeletonLogo: { width: sizing.logo, height: sizing.logo, borderRadius: sizing.logo / 4, backgroundColor: colors.elevated },
  skeletonIdentity: { flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: 6, paddingTop: 2 },
  skeletonAmount: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 104, alignItems: 'flex-end', gap: 6, paddingTop: 2 },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: colors.elevated },
});
