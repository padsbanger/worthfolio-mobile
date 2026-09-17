import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { colors } from '../../../theme/theme';

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text,
    headerShadowVisible: false, tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
    tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted }}>
    <Tabs.Screen name="index" options={{ title: 'Portfolio', headerTitle: 'Worthfolio',
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Account settings"
        onPress={() => router.push('/settings')} style={{ width: 56, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person-circle-outline" color={colors.text} size={28} />
      </Pressable>,
      tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart-outline" size={size} color={color} />,
    }} />
    <Tabs.Screen name="watchlists" options={{ title: 'Watchlists', tabBarIcon: ({ color, size }) => <Ionicons name="bookmark-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} /> }} />
  </Tabs>;
}
