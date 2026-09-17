import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSearch } from '../api/data';
import { DataNotice, Status, styles } from '../components/ui';
import { colors } from '../theme/theme';
import { ticker } from '../lib/format';

export function SearchScreen() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(input.trim()), 300); return () => clearTimeout(timer); }, [input]);
  const result = useSearch(query);
  const settled = query === input.trim();
  return <View style={styles.screen}><DataNotice />
    <FlatList data={settled && query.length >= 2 ? result.data?.results ?? [] : []} keyExtractor={item => item.symbol}
      keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      ListHeaderComponent={<View style={{ gap: 12 }}>
        <TextInput accessibilityLabel="Search instruments" placeholder="Company, symbol, or fund" placeholderTextColor={colors.muted}
          value={input} onChangeText={setInput} style={styles.input} autoCapitalize="none" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />
        <Text style={styles.small}>Discover an instrument and explore its price history.</Text>
      </View>}
      ListEmptyComponent={<Status title={input.trim().length < 2 ? 'Find your next idea' : !settled || result.isFetching ? 'Searching' : result.isError ? 'Search unavailable' : result.isPaused ? 'Connect to search' : 'No instruments found'}
        message={input.trim().length < 2 ? 'Enter at least two characters to search.' : result.error?.message}
        loading={input.trim().length >= 2 && (!settled || result.isFetching)} retry={result.isError ? () => void result.refetch() : undefined} />}
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}
        onPress={() => router.push({ pathname: '/instrument', params: { symbol: item.symbol } })}
        style={{ paddingVertical: 20, gap: 5, minHeight: 90 }}>
        <Text style={[styles.text, { fontWeight: '700' }]}>{ticker(item.symbol)}</Text>
        <Text style={styles.text}>{item.name}</Text>
        <Text style={styles.small}>{item.exchange} · {item.assetType}</Text>
      </Pressable>} />
  </View>;
}
