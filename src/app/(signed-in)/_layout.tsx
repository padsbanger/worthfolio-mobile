import { Stack } from 'expo-router';
import { DataProvider } from '../../api/data';
import { useSession } from '../../auth/session';
import { colors } from '../../theme/theme';

export default function SignedInLayout() {
  const { session } = useSession();
  return <DataProvider key={session?.id}>
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text,
      contentStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="instrument" options={{ title: 'Instrument' }} />
      <Stack.Screen name="settings" options={{ title: 'Account' }} />
    </Stack>
  </DataProvider>;
}
