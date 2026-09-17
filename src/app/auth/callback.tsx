import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../auth/session';
import { Button, Status, styles } from '../../components/ui';

export default function AuthCallback() {
  const { session, ready, busy, error } = useSession();
  // WebBrowser redeems the code in SessionProvider. Router sees the same deep
  // link first on Android: do not navigate into a protected route mid-exchange.
  if (!ready || busy) return <SafeAreaView style={styles.screen}>
    <Status title="Finishing sign-in" message="Checking your session and access to Worthfolio." loading />
  </SafeAreaView>;
  if (session) return <Redirect href="/" />;
  if (error) return <Redirect href="/sign-in" />;
  // Cold starts have no in-memory state/verifier. Never redeem their URL again.
  return <SafeAreaView style={styles.screen}>
    <Status title="Sign-in interrupted" message="There is no active sign-in request. Return to sign in and try again." />
    <Button title="Return to sign in" onPress={() => router.replace('/sign-in')} />
  </SafeAreaView>;
}
