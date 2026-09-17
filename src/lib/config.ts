export function parseServerUrl(value: string | undefined): { url: string; error: string | null } {
  try {
    if (!value?.trim()) throw new Error();
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        (url.pathname !== '/' && url.pathname !== '')) throw new Error();
    return { url: url.origin, error: null };
  } catch {
    return { url: '', error: 'Set EXPO_PUBLIC_API_URL to the HTTPS origin of your Worthfolio server, then restart the development server or rebuild the app.' };
  }
}

export const server = parseServerUrl(process.env.EXPO_PUBLIC_API_URL);
export const demoEnabled = __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
export const callbackUri = 'worthfolio://auth/callback';

// Public native client configuration; never add a client secret here.
export const oidc = {
  issuer: process.env.EXPO_PUBLIC_OIDC_ISSUER || 'https://auth.pripyat.cloud/application/o/worthfolio-mobile/',
  clientId: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID || '9k33r6Ly7z3MYeKYP8JWqjAQKUbxWFoti107Q7Yx',
};
