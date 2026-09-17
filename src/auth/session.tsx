import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ApiClient } from '../api/client';
import { credentialSchema, healthSchema, type Credential } from '../api/contracts';
import { callbackUri, demoEnabled, server } from '../lib/config';
import { z } from 'zod';

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
  const secureWrites = useRef(Promise.resolve());
  const persist = useCallback((credential: Credential | null) => {
    const operation = secureWrites.current.catch(() => {}).then(() => credential
      ? SecureStore.setItemAsync(storageKey, JSON.stringify({ server: server.url, ...credential }))
      : SecureStore.deleteItemAsync(storageKey));
    secureWrites.current = operation;
    return operation;
  }, []);

  const expire = useCallback(() => {
    generation.current++;
    setSession(null);
    setError('Your session ended. Please sign in again.');
    void persist(null).catch(() => setError('Session ended. Secure storage could not be cleared; retry sign out or restart the app.'));
  }, [persist]);

  useEffect(() => {
    let active = true;
    const initialGeneration = generation.current;
    void SecureStore.getItemAsync(storageKey).then(async raw => {
      if (!active || generation.current !== initialGeneration) return;
      if (!raw) return;
      const parsed = credentialSchema.extend({ server: z.string() }).safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data.server === server.url && parsed.data.expiresAt * 1000 > Date.now()) {
        setSession({ id: ++generation.current, demo: false, credential: parsed.data });
      } else await persist(null);
    }).catch(() => { if (active) setError('Could not restore your saved session. Please sign in again.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [persist]);

  useEffect(() => {
    if (!session?.credential) return;
    const remaining = () => session.credential!.expiresAt * 1000 - Date.now();
    const timer = setTimeout(expire, Math.max(0, remaining()));
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && remaining() <= 0) expire();
    });
    return () => { clearTimeout(timer); listener.remove(); };
  }, [expire, session]);

  async function signIn() {
    if (busy) return;
    if (server.error) { setError(server.error); return; }
    setBusy(true); setError(null);
    const attempt = ++generation.current;
    const client = new ApiClient(server.url);
    try {
      const health = await client.request('/api/health', healthSchema);
      if (health.authentication !== 'oidc' || !health.mobileAuth) {
        throw new Error('This server does not support mobile sign-in yet. The Worthfolio mobile authentication update must be deployed first.');
      }
      const state = Crypto.randomUUID();
      const verifier = (await Crypto.getRandomBytesAsync(32)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
      const challenge = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const query = new URLSearchParams({ state, code_challenge: challenge, code_challenge_method: 'S256', redirect_uri: callbackUri });
      const result = await WebBrowser.openAuthSessionAsync(`${server.url}/auth/mobile/login?${query}`, callbackUri);
      if (result.type !== 'success') return;
      const returned = new URL(result.url);
      if (`${returned.protocol}//${returned.host}${returned.pathname}` !== callbackUri || returned.searchParams.get('state') !== state) {
        throw new Error('The sign-in response did not match this request. Please try again.');
      }
      if (returned.searchParams.has('error')) throw new Error('Sign-in was not completed. Please try again.');
      const code = returned.searchParams.get('code');
      if (!code) throw new Error('Sign-in did not return a valid code. Please try again.');
      const credential = await client.request('/auth/mobile/token', credentialSchema,
        { body: { code, code_verifier: verifier, redirect_uri: callbackUri } });
      if (credential.expiresAt * 1000 <= Date.now()) throw new Error('The server returned an expired session. Check your device clock.');
      if (generation.current !== attempt) return;
      await persist(credential);
      if (generation.current === attempt) setSession({ id: attempt, credential, demo: false });
    } catch (caught) {
      if (generation.current === attempt) setError(caught instanceof Error ? caught.message : 'Sign-in failed. Please try again.');
    } finally { client.close(); setBusy(false); }
  }

  async function signOut() {
    const token = session?.credential?.accessToken;
    generation.current++;
    setSession(null); setError(null);
    await persist(null).catch(() => setError('Could not clear secure storage. Please retry sign out.'));
    if (token) {
      const client = new ApiClient(server.url, token);
      try { await client.request('/auth/mobile/logout', z.object({ loggedOut: z.boolean() }), { body: {} }); }
      catch { /* Local sign-out succeeds offline; the remote session expires normally. */ }
      finally { client.close(); }
    }
  }

  return <SessionContext.Provider value={{ session, ready, busy, error, signIn, signOut, expire,
    explore: () => { if (demoEnabled) { setError(null); setSession({ id: ++generation.current, credential: null, demo: true }); } },
  }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('SessionProvider is missing');
  return context;
}
