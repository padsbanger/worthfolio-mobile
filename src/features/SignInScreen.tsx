import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useSession } from '../auth/session';
import { Button, styles } from '../components/ui';
import { colors } from '../theme/theme';
import { demoEnabled, server } from '../lib/config';

function WorthfolioMark() {
  return <Svg width={44} height={44} viewBox="0 0 64 64" accessibilityElementsHidden>
    <Path d="m12 16 12 34 8-22 8 22 12-34" fill="none" stroke={colors.text} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="m18 35 9-7 10 6 11-13" fill="none" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function SignInScreen() {
  const { signIn, busy, error, explore } = useSession();
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={local.content}>
    <View style={local.mark} accessible accessibilityLabel="Worthfolio">
      <WorthfolioMark />
    </View>
    <Text style={local.brand}>Worthfolio</Text>
    <Text style={local.title}>Your portfolio.{ '\n' }A clearer view.</Text>
    <Text style={local.description}>Keep your holdings and watchlists close. Explore the market, wherever you are.</Text>
    <View style={local.connection}>
      <Text style={styles.label}>YOUR SERVER</Text>
      <Text style={styles.text}>{server.url || 'Not configured'}</Text>
    </View>
    {(server.error || error) && <Text accessibilityRole="alert" style={local.error}>{server.error || error}</Text>}
    <Button title={busy ? 'Connecting…' : 'Sign in with Authentik'} disabled={busy || !!server.error} onPress={() => void signIn()} />
    <Text style={styles.small}>Secure sign-in opens in your browser. Mobile access is read-only.</Text>
    {demoEnabled && <Button title="Explore sample portfolio" secondary disabled={busy} onPress={explore} />}
  </ScrollView></SafeAreaView>;
}
const local = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 28, gap: 22 },
  mark: { width: 76, height: 76, borderRadius: 22, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center' },
  brand: { color: colors.accent, fontSize: 17, fontWeight: '600', letterSpacing: 1 },
  title: { fontSize: 40, lineHeight: 46, letterSpacing: -1.5, fontWeight: '700', color: colors.text },
  description: { color: colors.muted, fontSize: 17, lineHeight: 26 },
  connection: { gap: 6, marginTop: 12 },
  error: { color: colors.warning, fontSize: 14, lineHeight: 22 },
});
