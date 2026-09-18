import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { periods, sortOptions, type AssetSort, type ListPeriod } from '../lib/list-view';
import { colors, shape, sizing, spacing, typography } from '../theme/theme';

export function ListControls({ sort, period, onSort, onPeriod, currency, loading = false }: {
  sort: AssetSort; period: ListPeriod; onSort(value: AssetSort): void; onPeriod(value: ListPeriod): void; currency: string; loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = sortOptions.find(option => option.id === sort)!;
  return <View style={local.container}>
    <View style={local.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Sort assets. ${selected.label}`} accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)} style={local.selector}>
        <Text style={local.text}>{selected.label}</Text><Text accessible={false} style={local.text}>⌄</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.chips} style={{ flexGrow: 0 }}>
        {periods.map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${item} price change`}
          accessibilityState={{ selected: item === period }} onPress={() => onPeriod(item)} style={[local.chip, item === period && local.selected]}>
          <Text style={[local.text, item === period && { color: colors.accent }]}>{item}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
    <Text style={local.caption}>{loading ? `Loading ${period} changes…` : sort.startsWith('price') ? `Unit price in ${currency} · missing FX last` : `Price change % · ${period === '1D' ? 'previous close' : 'observed closes'} · ${period}`}</Text>
    <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
      <View style={local.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => setOpen(false)} />
        <View style={local.dialog} accessibilityViewIsModal>
          <View style={local.heading}><Text accessibilityRole="header" style={[local.title, { flex: 1 }]}>Sort assets</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close sorting" onPress={() => setOpen(false)} style={local.close}><Text style={local.text}>Close</Text></Pressable>
          </View>
          <FlatList data={sortOptions} keyExtractor={item => item.id} extraData={sort} style={{ flexGrow: 0 }}
            renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: item.id === sort }}
              onPress={() => { onSort(item.id); setOpen(false); }} style={[local.option, item.id === sort && local.selected]}>
              <Text style={[local.title, { flex: 1 }]}>{item.label}</Text>{item.id === sort && <Text accessible={false} style={local.text}>✓</Text>}
            </Pressable>} />
        </View>
      </View>
    </Modal>
  </View>;
}

const local = StyleSheet.create({
  container: { gap: spacing.tight },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.tight },
  selector: { minHeight: sizing.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.small, paddingHorizontal: spacing.small, borderRadius: shape.control, backgroundColor: colors.surface, flexShrink: 1 },
  chips: { flexDirection: 'row', gap: spacing.tight },
  chip: { minHeight: sizing.touch, minWidth: sizing.touch, paddingHorizontal: spacing.small, alignItems: 'center', justifyContent: 'center', borderRadius: shape.control },
  selected: { backgroundColor: colors.elevated },
  text: { ...typography.label, color: colors.muted, fontWeight: '600', flexShrink: 1 },
  caption: { ...typography.caption, color: colors.muted },
  title: { ...typography.body, color: colors.text },
  backdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', paddingHorizontal: spacing.screen, paddingVertical: 48 },
  dialog: { maxHeight: '85%', backgroundColor: colors.surface, borderRadius: shape.card, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.screen },
  close: { minHeight: sizing.touch, minWidth: sizing.touch, paddingHorizontal: spacing.screen, justifyContent: 'center' },
  option: { minHeight: sizing.touch, flexDirection: 'row', alignItems: 'center', padding: spacing.section },
});
