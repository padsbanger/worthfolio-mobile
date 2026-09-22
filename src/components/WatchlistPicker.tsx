import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Watchlists } from '../api/contracts';
import { colors, shape, sizing, spacing, typography } from '../theme/theme';

export function WatchlistPicker({ lists, selectedId, onSelect }: {
  lists: Watchlists['watchlists']; selectedId?: string; onSelect(id: string): void;
}) {
  const [open, setOpen] = useState(false);
  const current = lists.find(list => list.id === selectedId);
  if (!lists.length) return null;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Choose watchlist. ${current?.name || 'Select a list'}`}
      accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={({ pressed }) => [local.selector, pressed && local.pressed]}>
      <View style={{ flex: 1 }}>
        <Text style={local.name}>{current?.name || 'Select a list'}</Text>
        {current && <Text style={local.caption}>{current.symbols.length} instruments</Text>}
      </View>
      <Text accessible={false} style={local.chevron}>⌄</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
      <View style={local.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => setOpen(false)} />
        <View style={local.dialog} accessibilityViewIsModal>
          <View style={local.heading}>
            <Text accessibilityRole="header" style={[local.name, { flex: 1 }]}>Choose watchlist</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close watchlist selector" onPress={() => setOpen(false)} style={({ pressed }) => [local.close, pressed && local.pressed]}>
              <Text style={local.action}>Close</Text>
            </Pressable>
          </View>
          <FlatList data={lists} extraData={selectedId} keyExtractor={item => item.id} style={{ flexGrow: 0 }}
            renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: item.id === selectedId }}
              accessibilityLabel={item.name} onPress={() => { onSelect(item.id); setOpen(false); }}
              style={({ pressed }) => [local.option, item.id === selectedId && local.selectedOption, pressed && local.pressed]}>
              <View style={{ flex: 1 }}><Text style={local.name}>{item.name}</Text>
                <Text style={local.caption}>{item.symbols.length} instruments</Text></View>
              {item.id === selectedId && <Text accessible={false} style={local.action}>✓</Text>}
            </Pressable>} />
        </View>
      </View>
    </Modal>
  </>;
}

const local = StyleSheet.create({
  selector: { minHeight: sizing.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.small,
    paddingHorizontal: spacing.section, paddingVertical: spacing.tight, backgroundColor: colors.surface, borderRadius: shape.control },
  name: { ...typography.body, color: colors.text, fontWeight: '600' },
  chevron: { ...typography.section, color: colors.muted },
  action: { ...typography.label, color: colors.accent },
  caption: { ...typography.caption, color: colors.muted },
  backdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', paddingHorizontal: spacing.screen, paddingVertical: 48 },
  dialog: { maxHeight: '85%', backgroundColor: colors.surface, borderRadius: shape.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.small, paddingLeft: spacing.screen, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  close: { minHeight: sizing.touch, minWidth: sizing.touch, paddingHorizontal: spacing.screen, justifyContent: 'center' },
  option: { minHeight: sizing.touch, padding: spacing.section, gap: spacing.small, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  selectedOption: { backgroundColor: `${colors.accent}14` },
  pressed: { opacity: 0.72 },
});
