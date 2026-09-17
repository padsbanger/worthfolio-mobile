import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../auth/session';
import { Status } from '../components/ui';
import { colors } from '../theme/theme';

function Navigation() {
  const { session, ready } = useSession();
  if (!ready) return <Status title="Opening Worthfolio" loading />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Protected guard={!session}><Stack.Screen name="sign-in" /></Stack.Protected>
    <Stack.Protected guard={!!session}><Stack.Screen name="(signed-in)" /></Stack.Protected>
    <Stack.Screen name="auth/callback" />
  </Stack>;
}
export default function RootLayout() {
  return <SessionProvider><StatusBar style="light" /><Navigation /></SessionProvider>;
}
