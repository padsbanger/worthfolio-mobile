import { useEffect, useState } from 'react';
import { Platform, Switch, Text, View } from 'react-native';
import { Button, Card, Label, styles } from '../components/ui';
import { pinWidget, setWidgetVisible, widgetAvailable, widgetVisible } from './bridge';

export function WidgetSettings() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void widgetVisible().then(value => { if (active) setVisible(value); })
      .catch(() => { if (active) setMessage('Widget settings could not be loaded.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  if (Platform.OS !== 'android') return null;
  return <Card style={styles.compactCard}>
    <Label>HOME-SCREEN WIDGET</Label>
    {!widgetAvailable ? <Text style={styles.small}>Install the latest Worthfolio Android build to use the widget.</Text> : <>
      <Text style={styles.small}>Shows the last portfolio snapshot. Open the app to refresh. Balances are hidden after sign-in or an app restart.</Text>
      <Text style={styles.small}>When shown, balances are visible on your home screen. Android may delay hiding them after session expiry or while the app is force-stopped.</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={[styles.text, { flex: 1 }]}>Show widget balances</Text>
        <Switch accessibilityLabel="Show widget balances" value={visible} disabled={busy} onValueChange={value => {
          setBusy(true); setMessage('');
          void setWidgetVisible(value).then(() => setVisible(value))
            .catch(() => setMessage('Could not update widget visibility. Please try again.')).finally(() => setBusy(false));
        }} />
      </View>
      <Button title="Add widget to home screen" secondary onPress={() => {
        void pinWidget().then(supported => setMessage(supported ? 'Confirm placement in your launcher.' :
          'Long-press your home screen, choose Widgets, then Worthfolio.'))
          .catch(() => setMessage('Long-press your home screen, choose Widgets, then Worthfolio.'));
      }} />
      {!!message && <Text accessibilityRole="alert" style={styles.small}>{message}</Text>}
    </>}
  </Card>;
}
