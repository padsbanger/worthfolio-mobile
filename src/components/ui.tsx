import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { PropsWithChildren } from 'react';
import { colors } from '../theme/theme';
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
export function DataNotice() {
  const { demo, online } = useData();
  if (!demo && online) return null;
  return <View style={styles.notice}><Text style={styles.noticeText}>
    {demo ? 'SAMPLE DATA · Development preview' : 'Offline · Showing loaded data when available'}
  </Text></View>;
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
  refreshRetry: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' },
  refreshRetryText: { color: colors.accent, fontSize: 12, lineHeight: 18 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18, paddingBottom: 36 },
  heading: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
  label: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  text: { color: colors.text, fontSize: 16, lineHeight: 24 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: { padding: 20, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  button: { minHeight: 48, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: colors.accent, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.elevated },
  buttonText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  status: { padding: 28, gap: 16, alignItems: 'center' },
  statusTitle: { color: colors.text, fontSize: 19, fontWeight: '600', textAlign: 'center' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  notice: { backgroundColor: colors.elevated, paddingVertical: 10, paddingHorizontal: 20 },
  noticeText: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { height: 1, backgroundColor: colors.border },
  input: { backgroundColor: colors.surface, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, minHeight: 52, fontSize: 16 },
});
