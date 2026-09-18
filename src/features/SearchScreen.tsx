import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useData, useSearch } from '../api/data';
import { CompanyLogo } from '../components/CompanyLogo';
import { DataNotice, RefreshHint, styles } from '../components/ui';
import { colors, shape, sizing, spacing, typography } from '../theme/theme';
import { ticker } from '../lib/format';

export function SearchScreen() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const field = useRef<TextInput>(null);
  useEffect(() => { const timer = setTimeout(() => setQuery(input.trim()), 300); return () => clearTimeout(timer); }, [input]);
  const settled = query === input.trim();
  const result = useSearch(query, settled);
  const { online, demo, active } = useData();
  const canSearch = demo || (online && active);
  const enoughInput = input.trim().length >= 2;
  const results = settled && query.length >= 2 ? result.data?.results ?? [] : [];
  const retry = canSearch && settled && result.isError ? () => void result.refetch({ cancelRefetch: false }) : undefined;
  const loading = canSearch && enoughInput && (!settled || result.isFetching);
  const title = !enoughInput ? 'Find an instrument' : !canSearch || result.isPaused ? 'Connect to search'
    : loading ? 'Searching' : result.isError ? 'Search unavailable' : 'No instruments found';
  const message = !enoughInput ? 'Enter at least two characters: a company, symbol, or fund.'
    : !canSearch ? 'Reconnect to look up instruments.' : loading ? undefined
      : result.isError ? result.error.message : 'Try another name or ticker.';
  const clear = () => { setInput(''); setQuery(''); field.current?.focus(); };
  return <View style={styles.screen}><DataNotice />
    <View style={local.searchArea}>
      <View style={local.searchField}>
        <Ionicons name="search-outline" size={20} color={colors.muted} accessible={false} />
        <TextInput ref={field} accessibilityLabel="Search instruments" placeholder="Company, symbol, or fund" placeholderTextColor={colors.muted}
          value={input} onChangeText={setInput} style={local.input} autoCapitalize="none" autoCorrect={false} returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()} />
        {!!input.length && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={clear} style={local.clear}>
          <Ionicons name="close-circle" size={20} color={colors.muted} accessible={false} />
        </Pressable>}
      </View>
    </View>
    <FlatList key={query} data={results} keyExtractor={item => item.symbol}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={results.length ? <View style={local.resultsHeader}>
        <Text style={styles.small}>{results.length} {results.length === 1 ? 'result' : 'results'}</Text>
        {result.isError && <RefreshHint busy={result.isFetching} retry={retry} />}
      </View> : null}
      ListEmptyComponent={<View style={local.empty} accessibilityLiveRegion="polite">
        <View style={styles.row}>{loading && <ActivityIndicator size="small" color={colors.accent} />}
          <Text style={local.emptyTitle}>{title}</Text></View>
        {!!message && <Text style={styles.label}>{message}</Text>}
        {retry && <Pressable accessibilityRole="button" onPress={retry} style={local.retry}>
          <Text style={local.retryText}>Try again</Text></Pressable>}
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}
        accessibilityHint={`${item.symbol}. ${item.exchange}. ${item.assetType}. Opens instrument details.`}
        onPress={() => { Keyboard.dismiss(); router.push({ pathname: '/instrument', params: { symbol: item.symbol } }); }}
        style={({ pressed }) => [local.result, pressed && { backgroundColor: colors.surface }]}>
        <CompanyLogo symbol={item.symbol} logoUrl={item.logoUrl} logoFallbackUrl={item.logoFallbackUrl} size={sizing.logo} />
        <View style={local.identity}>
          <Text style={local.name}>{item.name}</Text>
          <Text style={styles.label}>{[ticker(item.symbol), item.exchange, item.assetType].filter(Boolean).join(' \u00b7 ')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} accessible={false} />
      </Pressable>} />
  </View>;
}

const local = StyleSheet.create({
  searchArea: { paddingHorizontal: spacing.screen, paddingTop: spacing.section },
  searchField: { flexDirection: 'row', alignItems: 'center', gap: spacing.small, paddingLeft: spacing.section,
    backgroundColor: colors.surface, borderRadius: shape.control, borderWidth: 1, borderColor: colors.border },
  input: { ...typography.body, color: colors.text, flex: 1, minWidth: 0, minHeight: sizing.touch, paddingVertical: spacing.small, paddingRight: spacing.small },
  clear: { minWidth: sizing.touch, minHeight: sizing.touch, alignItems: 'center', justifyContent: 'center' },
  resultsHeader: { gap: spacing.tight, paddingBottom: spacing.tight },
  empty: { paddingVertical: spacing.section, gap: spacing.small },
  emptyTitle: { ...typography.body, fontWeight: '600', color: colors.text, flexShrink: 1 },
  retry: { minHeight: sizing.touch, minWidth: sizing.touch, alignSelf: 'flex-start', justifyContent: 'center' },
  retryText: { ...typography.label, color: colors.accent },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.section, minHeight: 72, paddingVertical: spacing.section,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  identity: { flex: 1, gap: spacing.tight },
  name: { ...typography.body, fontWeight: '600', color: colors.text },
});
