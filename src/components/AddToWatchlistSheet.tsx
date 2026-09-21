import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Watchlist } from '../api/contracts';
import { colors, sizing, spacing } from '../theme/theme';
import { styles } from './ui';

export function AddToWatchlistSheet({ visible, symbol, lists, pendingId, success, error, unavailable, onClose, onToggle }: {
  visible: boolean; symbol: string; lists: Watchlist[]; pendingId?: string; success?: string; error?: string;
  unavailable?: string; onClose(): void; onToggle(list: Watchlist): void;
}) {
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
    <View style={[local.backdrop, { paddingTop: insets.top + spacing.screen }]}>
      <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={onClose} />
      <View accessibilityViewIsModal style={[local.sheet, { paddingBottom: Math.max(insets.bottom, spacing.screen) }]}>
        <View style={local.heading}>
          <View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.sectionHeading}>Watchlists</Text>
            <Text style={styles.small}>{symbol}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close watchlist chooser" onPress={onClose} style={local.close}>
            <Text style={[styles.label, { color: colors.accent }]}>{success ? 'Done' : 'Close'}</Text>
          </Pressable>
        </View>
        <Text style={[styles.small, local.message]}>Tap a list to add this instrument. Tap a checked list to remove it.</Text>
        <ScrollView style={{ flexGrow: 0 }}>
          {lists.map(list => {
            const added = list.symbols.includes(symbol);
            const saving = pendingId === list.id;
            const disabled = !!pendingId || !!unavailable;
            return <Pressable key={list.id} accessibilityRole="button" accessibilityLabel={`${added ? 'Remove from' : 'Add to'} ${list.name}`}
              accessibilityState={{ disabled, busy: saving, selected: added }} disabled={disabled} onPress={() => onToggle(list)}
              style={({ pressed }) => [local.row, pressed && { backgroundColor: colors.background }]}>
              <View style={{ flex: 1, gap: 2 }}><Text style={styles.text}>{list.name}</Text>
                <Text style={styles.small}>{saving ? (added ? 'Removing…' : 'Adding…') : added ? 'Added · Tap to remove' : `${list.symbols.length} instruments`}</Text></View>
              {saving ? <ActivityIndicator color={colors.accent} /> : <Ionicons accessible={false} name={added ? 'checkmark-circle' : 'add-outline'} size={24} color={added ? colors.accent : colors.muted} />}
            </Pressable>;
          })}
        </ScrollView>
        {!lists.length && <Text style={[styles.label, local.message]}>No watchlists available. Create a watchlist in Worthfolio first.</Text>}
        {!!unavailable && <Text style={[styles.small, local.message]}>{unavailable}</Text>}
        {!!success && <Text accessibilityLiveRegion="polite" style={[styles.label, local.message, { color: colors.positive }]}>{success}</Text>}
        {!!error && <Text accessibilityLiveRegion="polite" style={[styles.label, local.message, { color: colors.warning }]}>{error} Tap a list to try again.</Text>}
      </View>
    </View>
  </Modal>;
}

const local = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' },
  sheet: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.screen, paddingTop: spacing.small },
  close: { minHeight: sizing.touch, minWidth: sizing.touch, justifyContent: 'center', paddingHorizontal: spacing.screen },
  message: { paddingHorizontal: spacing.screen, paddingVertical: spacing.small },
  row: { minHeight: sizing.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.small, padding: spacing.screen, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
