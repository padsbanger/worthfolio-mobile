import { Redirect } from 'expo-router';
import { DesignPreviewScreen } from '../../features/DesignPreviewScreen';

export default function DesignPreview() {
  return __DEV__ ? <DesignPreviewScreen /> : <Redirect href="/settings" />;
}
