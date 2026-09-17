import { ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useBootstrap } from '../api/data';
import { useSession } from '../auth/session';
import { Button, Card, DataNotice, Heading, Label, styles } from '../components/ui';
import { server } from '../lib/config';

export function SettingsScreen() {
  const { data } = useBootstrap();
  const { session, signOut } = useSession();
  return <View style={styles.screen}><DataNotice /><ScrollView contentContainerStyle={styles.content}>
    <Heading>Your account</Heading>
    <Card><Label>SIGNED IN AS</Label><Text style={styles.text}>{data?.authUser.name || 'Loading account'}</Text>
      {!!data?.authUser.email && <Text style={styles.label}>{data.authUser.email}</Text>}
    </Card>
    <Card><Label>WORTHFOLIO SERVER</Label><Text style={styles.text}>{server.url || 'Not configured'}</Text>
      <Label>Read-only mobile access</Label>
    </Card>
    <Text style={styles.label}>Version {Constants.expoConfig?.version || '0.1.0'}</Text>
    <Text style={styles.small}>Portfolio data stays in memory and is cleared when you sign out. You may need to sign in again after your session expires or the server restarts.</Text>
    <Button title={session?.demo ? 'Leave sample portfolio' : 'Sign out'} secondary onPress={() => void signOut()} />
  </ScrollView></View>;
}
