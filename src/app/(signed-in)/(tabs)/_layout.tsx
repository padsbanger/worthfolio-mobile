import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, sizing, typography } from '../../../theme/theme';

export default function TabsLayout() {
  const { fontScale } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  return <Tabs screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text,
    headerShadowVisible: false, tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border,
      height: 60 + Math.max(0, fontScale - 1) * 32 + bottom, paddingTop: 4, paddingBottom: bottom },
    headerTitleStyle: { fontSize: typography.title.fontSize, fontWeight: '700' },
    tabBarItemStyle: { minHeight: sizing.touch },
    tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
    tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted }}>
    <Tabs.Screen name="index" options={{ title: 'Portfolio', headerTitle: 'Worthfolio',
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Account settings"
        onPress={() => router.push('/settings')} style={{ width: 56, minHeight: sizing.touch, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person-circle-outline" color={colors.text} size={26} />
      </Pressable>,
      tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={24} color={color} />,
    }} />
    <Tabs.Screen name="watchlists" options={{ title: 'Watchlists', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'bookmark' : 'bookmark-outline'} size={24} color={color} /> }} />
    <Tabs.Screen name="search" options={{ title: 'Search', tabBarHideOnKeyboard: true,
      tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} /> }} />
  </Tabs>;
}
