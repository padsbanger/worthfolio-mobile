import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ApiClient, ApiError } from '../api/client';
import { bootstrapSchema, credentialSchema, type Credential } from '../api/contracts';
import { callbackUri, demoEnabled, oidc, server } from '../lib/config';
import { OidcClient, type Discovery } from './oidc';
import { z } from 'zod';
import { activateWidget, clearWidget } from '../widget/bridge';

const storageKey = 'worthfolio.session.v1';
type Session = { id: number; credential: Credential | null; demo: boolean };
type SessionContextValue = {
  session: Session | null; ready: boolean; busy: boolean; error: string | null;
  signIn(): Promise<void>; signOut(): Promise<void>; expire(): void; explore(): void;
};
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const loginClient = useRef<OidcClient | null>(null);
  const browserOpen = useRef(false);
  const secureWrites = useRef(Promise.resolve());
  const persist = useCallback((credential: Credential | null) => {
    const operation = secureWrites.current.catch(() => {}).then(() => credential
      ? SecureStore.setItemAsync(storageKey, JSON.stringify({ server: server.url, ...oidc, ...credential }))
      : SecureStore.deleteItemAsync(storageKey));
    secureWrites.current = operation;
    return operation;
  }, []);

  const expire = useCallback(() => {
    generation.current++;
    void clearWidget().catch(() => {});
    setSession(null);
    setError('Your session ended. Please sign in again.');
    void persist(null).catch(() => setError('Session ended. Secure storage could not be cleared; retry sign out or restart the app.'));
  }, [persist]);

  useEffect(() => {
    let active = true;
    const initialGeneration = generation.current;
    void SecureStore.getItemAsync(storageKey).then(async raw => {
      if (!active || generation.current !== initialGeneration) return;
      if (!raw) { await clearWidget(); return; }
      const parsed = credentialSchema.extend({ server: z.string(), issuer: z.string(), clientId: z.string() }).safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data.server === server.url && parsed.data.issuer === oidc.issuer &&
          parsed.data.clientId === oidc.clientId && parsed.data.expiresAt * 1000 > Date.now()) {
        const id = ++generation.current;
        await activateWidget(id, Crypto.randomUUID(), parsed.data.expiresAt).catch(() => {});
        if (active && generation.current === id) setSession({ id, demo: false, credential: parsed.data });
      } else { await clearWidget(); await persist(null); }
    }).catch(() => { void clearWidget().catch(() => {}); if (active) setError('Could not restore your saved session. Please sign in again.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [persist]);

  useEffect(() => {
    if (!session?.credential) return;
    const remaining = () => session.credential!.expiresAt * 1000 - Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      if (remaining() <= 0) expire();
      else timer = setTimeout(checkExpiry, Math.min(remaining(), 2_147_483_647));
    };
    checkExpiry();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && remaining() <= 0) expire();
    });
    return () => { clearTimeout(timer); listener.remove(); };
  }, [expire, session]);

  async function signIn() {
    // A ref also blocks repeated taps within the same React render.
    if (!ready || loginClient.current) return;
    if (server.error) { setError(server.error); return; }
    setBusy(true); setError(null);
    const attempt = ++generation.current;
    const client = new OidcClient();
    loginClient.current = client;
    let discovery: Discovery | undefined;
    let issuedCredential: Credential | undefined;
    let activated = false;
    try {
      discovery = await client.discover();
      if (generation.current !== attempt) return;
      const state = Crypto.randomUUID();
      const verifier = (await Crypto.getRandomBytesAsync(32)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
      const challenge = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const query = new URLSearchParams({ state, code_challenge: challenge, code_challenge_method: 'S256', redirect_uri: callbackUri,
        client_id: oidc.clientId, response_type: 'code', scope: 'openid profile email' });
      if (generation.current !== attempt) return;
      browserOpen.current = true;
      const result = await WebBrowser.openAuthSessionAsync(`${discovery.authorization_endpoint}?${query}`, callbackUri);
      browserOpen.current = false;
      if (result.type !== 'success' || generation.current !== attempt) return;
      const returned = new URL(result.url);
      if (`${returned.protocol}//${returned.host}${returned.pathname}` !== callbackUri || returned.username || returned.password || returned.hash ||
          returned.searchParams.getAll('state').length !== 1 || returned.searchParams.get('state') !== state) {
        throw new Error('The sign-in response did not match this request. Please try again.');
      }
      if (returned.searchParams.has('error')) throw new Error('Sign-in was not completed. Please try again.');
      const code = returned.searchParams.get('code');
      if (!code || returned.searchParams.getAll('code').length !== 1) throw new Error('Sign-in did not return a valid code. Please try again.');
      const credential = await client.exchange(discovery, code, verifier);
      issuedCredential = credential;
      if (credential.expiresAt * 1000 <= Date.now()) throw new Error('Authentik returned an expired session. Please sign in again.');
      if (generation.current !== attempt) return;
      // Provider login alone is not proof that Worthfolio accepts this identity.
      const api = new ApiClient(server.url, credential.accessToken);
      try {
        await api.request('/api/bootstrap', bootstrapSchema, { signal: client.signal });
      } catch (caught) {
        if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) {
          throw new Error('Authentik sign-in succeeded, but Worthfolio denied API access. The hosted backend must accept access tokens from the mobile client; server access rules may also need checking.');
        }
        throw caught;
      } finally { api.close(); }
      if (generation.current !== attempt) return;
      if (credential.expiresAt * 1000 <= Date.now()) throw new Error('The access token expired. Please sign in again.');
      await persist(credential);
      if (generation.current === attempt) await activateWidget(attempt, Crypto.randomUUID(), credential.expiresAt).catch(() => {});
      if (generation.current === attempt) {
        activated = true;
        setSession({ id: attempt, credential, demo: false });
      }
    } catch (caught) {
      if (generation.current === attempt) setError(caught instanceof Error ? caught.message : 'Sign-in failed. Please try again.');
    } finally {
      client.close(); browserOpen.current = false;
      if (loginClient.current === client) loginClient.current = null;
      setBusy(false);
      if (issuedCredential && !activated) {
        const cleanup = new OidcClient();
        void cleanup.revoke(issuedCredential.accessToken, discovery).catch(() => {}).finally(() => cleanup.close());
      }
    }
  }

  async function signOut() {
    const token = session?.credential?.accessToken;
    generation.current++;
    void clearWidget().catch(() => {});
    loginClient.current?.close();
    if (browserOpen.current) {
      try { WebBrowser.dismissAuthSession(); } catch { /* The browser may already have closed. */ }
    }
    setSession(null); setError(null);
    await persist(null).catch(() => setError('Could not clear secure storage. Please retry sign out.'));
    if (token) {
      const client = new OidcClient();
      try { await client.revoke(token); }
      catch { /* Local sign-out succeeds offline; the access token expires normally. */ }
      finally { client.close(); }
    }
  }

  return <SessionContext.Provider value={{ session, ready, busy, error, signIn, signOut, expire,
    explore: () => { if (demoEnabled) { void clearWidget().catch(() => {}); setError(null); setSession({ id: ++generation.current, credential: null, demo: true }); } },
  }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('SessionProvider is missing');
  return context;
}
