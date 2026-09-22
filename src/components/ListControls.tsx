import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { periods, sortOptions, type AssetSort, type ListPeriod } from '../lib/list-view';
import { colors, shape, sizing, spacing, typography } from '../theme/theme';

export function ListControls({ sort, period, onSort, onPeriod, onReset, currency, loading = false }: {
  sort: AssetSort; period: ListPeriod; onSort(value: AssetSort): void; onPeriod(value: ListPeriod): void; onReset?(): void; currency: string; loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const selected = sortOptions.find(option => option.id === sort)!;
  const changed = sort !== 'default' || period !== '1D';
  const stacked = width / fontScale < 440;
  return <View style={local.container}>
    <View style={[local.toolbar, stacked && local.stackedToolbar]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Sort assets. ${selected.label}`} accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)} style={({ pressed }) => [local.selector, pressed && local.pressed]}>
        <Text style={[local.text, { flex: 1 }]}>Sort: {selected.label}</Text><Text accessible={false} style={local.text}>{'\u25be'}</Text>
      </Pressable>
      <View accessibilityLabel="Price change period" style={[local.chips, stacked && local.stackedChips]}>
        {periods.map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${item} price change`}
          accessibilityState={{ selected: item === period }} onPress={() => onPeriod(item)} style={({ pressed }) => [local.chip, item === period && local.selectedChip, pressed && local.pressed]}>
          <Text style={[local.text, item === period && { color: colors.accent }]}>{item}</Text>
        </Pressable>)}
      </View>
    </View>
    <Text style={local.caption}>{loading ? `Loading ${period} changes\u2026` : sort.startsWith('price') ? `Unit price in ${currency} \u00b7 missing FX last` : `${period} price change \u00b7 ${period === '1D' ? 'previous close' : 'observed closes'}`}</Text>
    <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
      <View style={local.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => setOpen(false)} />
        <View style={local.dialog} accessibilityViewIsModal>
          <View style={local.heading}><Text accessibilityRole="header" style={[local.title, { flex: 1 }]}>Sort assets</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close sorting" onPress={() => setOpen(false)} style={({ pressed }) => [local.close, pressed && local.pressed]}><Text style={local.text}>Close</Text></Pressable>
          </View>
          <FlatList data={sortOptions} keyExtractor={item => item.id} extraData={sort} style={{ flexGrow: 0 }}
            renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: item.id === sort }}
              onPress={() => { onSort(item.id); setOpen(false); }} style={({ pressed }) => [local.option, item.id === sort && local.selectedOption, pressed && local.pressed]}>
              <Text style={[local.title, { flex: 1 }]}>{item.label}</Text>{item.id === sort && <Text accessible={false} style={local.text}>{'\u2713'}</Text>}
            </Pressable>} />
          {changed && onReset && <Pressable accessibilityRole="button" accessibilityLabel="Reset list view"
            onPress={() => { onReset(); setOpen(false); }} style={({ pressed }) => [local.option, pressed && local.pressed]}>
            <Text style={local.resetText}>Reset sort and period</Text>
          </Pressable>}
        </View>
      </View>
    </Modal>
  </View>;
}

const local = StyleSheet.create({
  container: { gap: spacing.tight },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.tight, padding: spacing.tight / 2, borderRadius: shape.control + 2, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  stackedToolbar: { alignItems: 'stretch' },
  selector: { minHeight: sizing.touch, flexGrow: 1, flexBasis: 168, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.small, paddingHorizontal: spacing.section, borderRadius: shape.control, backgroundColor: colors.elevated },
  chips: { flexGrow: 1, flexBasis: 160, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.tight },
  stackedChips: { width: '100%' },
  chip: { minHeight: sizing.touch, minWidth: sizing.touch, flexGrow: 1, paddingHorizontal: spacing.small, alignItems: 'center', justifyContent: 'center', borderRadius: shape.control },
  selectedChip: { backgroundColor: `${colors.accent}1F`, borderWidth: StyleSheet.hairlineWidth, borderColor: `${colors.accent}66` },
  selectedOption: { backgroundColor: `${colors.accent}14` },
  pressed: { opacity: 0.72 },
  text: { ...typography.label, color: colors.muted, fontWeight: '600', flexShrink: 1 },
  caption: { ...typography.caption, color: colors.muted },
  resetText: { ...typography.label, color: colors.accent, fontWeight: '600' },
  title: { ...typography.body, color: colors.text },
  backdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', paddingHorizontal: spacing.screen, paddingVertical: 48 },
  dialog: { maxHeight: '85%', backgroundColor: colors.surface, borderRadius: shape.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.screen, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  close: { minHeight: sizing.touch, minWidth: sizing.touch, paddingHorizontal: spacing.screen, justifyContent: 'center' },
  option: { minHeight: sizing.touch, flexDirection: 'row', alignItems: 'center', padding: spacing.section, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
