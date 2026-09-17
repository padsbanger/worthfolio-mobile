import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Worthfolio',
  slug: 'worthfolio-mobile',
  version: '0.1.0',
  scheme: 'worthfolio',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  android: { package: 'com.worthfolio.mobile', allowBackup: false },
  ios: { bundleIdentifier: 'com.worthfolio.mobile', supportsTablet: false },
  plugins: ['expo-router', 'expo-secure-store', 'expo-web-browser', 'expo-status-bar', 'expo-font'],
  experiments: { typedRoutes: true },
  owner: process.env.EXPO_OWNER || 'padsbanger',
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID || '88df6ef6-386b-44de-ab0e-a9bc68b80929' } },
};

export default config;
