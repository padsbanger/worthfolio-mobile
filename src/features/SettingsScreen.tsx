import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, sizing, spacing } from '../theme/theme';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useBootstrap } from '../api/data';
import { useSession } from '../auth/session';
import { Button, Card, DataNotice, Label, styles } from '../components/ui';
import { server } from '../lib/config';
import { WidgetSettings } from '../widget/WidgetSettings';

export function SettingsScreen() {
  const { data } = useBootstrap();
  const [sessionDetails, setSessionDetails] = useState(false);
  const insets = useSafeAreaInsets();
  const { session, signOut } = useSession();
  return <View style={styles.screen}><DataNotice /><ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: spacing.bottom + insets.bottom }]}>
    <Text style={styles.sectionHeading}>Account details</Text>
    <Card style={styles.compactCard}><Label>SIGNED IN AS</Label><Text style={styles.text}>{data?.authUser.name || 'Loading account'}</Text>
      {!!data?.authUser.email && <Text style={styles.label}>{data.authUser.email}</Text>}
    </Card>
    <Card style={styles.compactCard}><Label>WORTHFOLIO SERVER</Label><Text style={styles.text}>{server.url || 'Not configured'}</Text>
      <Label>View your portfolio and add or remove instruments from existing watchlists.</Label>
    </Card>
    {!session?.demo && <View style={local.section}><Text style={styles.sectionHeading}>Home screen</Text><WidgetSettings /></View>}
    <Text style={styles.sectionHeading}>Session</Text>
    <View style={local.section}>
      <Text style={styles.small}>Sign in again when your session ends.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Session details" accessibilityState={{ expanded: sessionDetails }} onPress={() => setSessionDetails(value => !value)}
        style={({ pressed }) => [local.disclosure, pressed && { opacity: 0.72 }]}>
        <Text style={[styles.small, { color: colors.accent }]}>{sessionDetails ? 'Hide details' : 'Show details'}</Text>
      </Pressable>
      {sessionDetails && <Text style={styles.small}>Portfolio data stays in memory, except for a small encrypted widget snapshot that is cleared when you sign out. When your access token expires or is revoked, sign in again. Signing out here leaves your browser?s Authentik session signed in.</Text>}
    </View>
    <Button title={session?.demo ? 'Leave sample portfolio' : 'Sign out'} secondary onPress={() => void signOut()} />
    {__DEV__ && <View style={local.section}><Text style={styles.sectionHeading}>Development</Text><Button title="Design preview" secondary onPress={() => router.push('/design-preview')} /></View>}
    <View style={local.appInfo}><Text style={styles.label}>Version {Constants.expoConfig?.version || '0.1.0'} (build {Constants.expoConfig?.android?.versionCode ?? 1})</Text></View>
  </ScrollView></View>;
}

const local = StyleSheet.create({
  disclosure: { minHeight: sizing.touch, minWidth: sizing.touch, alignSelf: 'flex-start', justifyContent: 'center' },
  section: { gap: spacing.small },
  appInfo: { paddingTop: spacing.small, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2B313B' },
});
