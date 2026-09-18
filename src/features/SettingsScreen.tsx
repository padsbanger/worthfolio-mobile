import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme/theme';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useBootstrap } from '../api/data';
import { useSession } from '../auth/session';
import { Button, Card, DataNotice, Heading, Label, styles } from '../components/ui';
import { server } from '../lib/config';
import { WidgetSettings } from '../widget/WidgetSettings';

export function SettingsScreen() {
  const { data } = useBootstrap();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useSession();
  return <View style={styles.screen}><DataNotice /><ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: spacing.bottom + insets.bottom }]}>
    <Heading>Your account</Heading>
    <Card style={styles.compactCard}><Label>SIGNED IN AS</Label><Text style={styles.text}>{data?.authUser.name || 'Loading account'}</Text>
      {!!data?.authUser.email && <Text style={styles.label}>{data.authUser.email}</Text>}
    </Card>
    <Card style={styles.compactCard}><Label>WORTHFOLIO SERVER</Label><Text style={styles.text}>{server.url || 'Not configured'}</Text>
      <Label>Read-only mobile access</Label>
    </Card>
    {!session?.demo && <WidgetSettings />}
    <Text style={styles.label}>Version {Constants.expoConfig?.version || '0.1.0'} (build {Constants.expoConfig?.android?.versionCode ?? 1})</Text>
    <Text style={styles.small}>Portfolio data stays in memory, except for a small encrypted widget snapshot that is cleared when you sign out. When your access token expires or is revoked, sign in again. Signing out here leaves your browser’s Authentik session signed in.</Text>
    <Button title={session?.demo ? 'Leave sample portfolio' : 'Sign out'} secondary onPress={() => void signOut()} />
    {__DEV__ && <Button title="Design preview" secondary onPress={() => router.push('/design-preview')} />}
  </ScrollView></View>;
}
