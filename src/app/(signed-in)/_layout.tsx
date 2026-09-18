import { Stack } from 'expo-router';
import { DataProvider } from '../../api/data';
import { useSession } from '../../auth/session';
import { colors, typography } from '../../theme/theme';

export default function SignedInLayout() {
  const { session } = useSession();
  return <DataProvider key={session?.id}>
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text,
      contentStyle: { backgroundColor: colors.background }, headerShadowVisible: false,
      headerTitleStyle: { fontSize: typography.section.fontSize, fontWeight: '600' } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="instrument" options={{ title: 'Instrument' }} />
      <Stack.Screen name="settings" options={{ title: 'Account' }} />
      <Stack.Protected guard={__DEV__}><Stack.Screen name="design-preview" options={{ title: 'Design preview' }} /></Stack.Protected>
    </Stack>
  </DataProvider>;
}
