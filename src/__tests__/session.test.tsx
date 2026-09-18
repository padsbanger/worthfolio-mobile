import { createHash } from 'node:crypto';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { SessionProvider, useSession } from '../auth/session';
import { sampleBootstrap } from '../fixtures/portfolio';
import { oidc } from '../lib/config';
import { activateWidget, clearWidget } from '../widget/bridge';

jest.mock('../widget/bridge', () => ({ activateWidget: jest.fn().mockResolvedValue(undefined), clearWidget: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../lib/config', () => ({
  server: { url: 'https://worthfolio.test', error: null }, demoEnabled: true, callbackUri: 'worthfolio://auth/callback',
  oidc: { issuer: 'https://auth.test/application/o/mobile/', clientId: 'public-mobile-client' },
}));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(), dismissAuthSession: jest.fn(), WebBrowserResultType: { CANCEL: 'cancel' },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'test-state-1234567890',
  getRandomBytesAsync: async () => new Uint8Array(32).fill(1),
  digestStringAsync: async (_algorithm: string, input: string) =>
    jest.requireActual<typeof import('node:crypto')>('node:crypto').createHash('sha256').update(input).digest('base64'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, CryptoEncoding: { BASE64: 'base64' },
}));

const originalFetch = global.fetch;
const getSaved = jest.mocked(SecureStore.getItemAsync);
const save = jest.mocked(SecureStore.setItemAsync);
const remove = jest.mocked(SecureStore.deleteItemAsync);
const browser = jest.mocked(WebBrowser.openAuthSessionAsync);
const state = 'test-state-1234567890';
const callback = `worthfolio://auth/callback?state=${state}&code=authorization-code`;
const credential = () => ({ accessToken: 'test-mobile-token', tokenType: 'Bearer', expiresAt: Date.now() / 1000 + 120 });
const discovery = {
  issuer: 'https://auth.test/application/o/mobile/',
  authorization_endpoint: 'https://auth.test/application/o/authorize/',
  token_endpoint: 'https://auth.test/application/o/token/',
  revocation_endpoint: 'https://auth.test/application/o/revoke/',
  response_types_supported: ['code'], code_challenge_methods_supported: ['S256'],
};
const tokenResponse = { access_token: 'test-mobile-token', token_type: 'Bearer', expires_in: 120,
  id_token: 'unused-id-token', refresh_token: 'unused-refresh-token' };
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
let fetcher: jest.Mock;
const defaultFetch = async (url: string) => {
  if (url.endsWith('/.well-known/openid-configuration')) return response(discovery);
  if (url === discovery.token_endpoint) return response(tokenResponse);
  if (url.endsWith('/api/bootstrap')) return response(sampleBootstrap);
  if (url === discovery.revocation_endpoint) return response(undefined);
  throw new Error('Unexpected test request');
};

beforeEach(() => {
  jest.useFakeTimers();
  getSaved.mockReset().mockResolvedValue(null);
  save.mockReset().mockResolvedValue();
  remove.mockReset().mockResolvedValue();
  browser.mockReset().mockResolvedValue({ type: 'success', url: callback });
  fetcher = jest.fn(defaultFetch);
  global.fetch = fetcher;
});
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

async function setup() {
  const hook = renderHook(useSession, { wrapper: SessionProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}

test('public-client login binds state and S256, verifies API access, and stores only the access token', async () => {
  const { result } = await setup();
  await act(() => result.current.signIn());
  expect(result.current.session?.credential?.accessToken).toBe('test-mobile-token');
  expect(activateWidget).toHaveBeenCalledWith(result.current.session!.id, expect.any(String), credential().expiresAt);
  const launch = new URL(browser.mock.calls[0]![0]);
  const request = fetcher.mock.calls[1]![1];
  const body = Object.fromEntries(new URLSearchParams(request.body));
  expect(launch.origin + launch.pathname).toBe(discovery.authorization_endpoint);
  expect(launch.searchParams.get('client_id')).toBe(oidc.clientId);
  expect(launch.searchParams.get('response_type')).toBe('code');
  expect(launch.searchParams.get('scope')).toBe('openid profile email');
  expect(launch.searchParams.get('state')).toBe(state);
  expect(launch.searchParams.get('redirect_uri')).toBe('worthfolio://auth/callback');
  expect(launch.searchParams.get('code_challenge_method')).toBe('S256');
  expect(launch.searchParams.get('code_challenge')).toBe(createHash('sha256').update(body.code_verifier!).digest('base64url'));
  expect(body.code_verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
  expect(body).toMatchObject({ code: 'authorization-code', client_id: oidc.clientId,
    redirect_uri: 'worthfolio://auth/callback', grant_type: 'authorization_code' });
  expect(body).not.toHaveProperty('client_secret');
  expect(request).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  expect(request.headers).not.toHaveProperty('Authorization');
  expect(fetcher.mock.calls[2]).toEqual(['https://worthfolio.test/api/bootstrap', expect.objectContaining({
    credentials: 'omit', headers: { Accept: 'application/json', Authorization: 'Bearer test-mobile-token' },
  })]);
  const stored = JSON.parse(save.mock.calls[0]![1]);
  expect(stored).toEqual({ server: 'https://worthfolio.test', ...oidc, ...credential() });
  expect(result.current.busy).toBe(false);
});

test('expiry clears the widget and invalidates the mobile session', async () => {
  const { result } = await setup();
  await act(() => result.current.signIn());
  jest.mocked(clearWidget).mockClear();
  act(() => result.current.expire());
  expect(clearWidget).toHaveBeenCalledTimes(1);
  expect(result.current.session).toBeNull();
});

test.each([
  callback.replace(state, 'wrong-state'),
  callback.replace('worthfolio://auth', 'attacker://auth'),
  callback + '&state=duplicate',
  callback + '&code=duplicate',
  callback + '#fragment',
  `worthfolio://auth/callback?state=${state}&error=access_denied`,
])('rejects invalid or failed callback without exchanging it: %s', async url => {
  browser.mockResolvedValue({ type: 'success', url });
  const { result } = await setup();
  await act(() => result.current.signIn());
  expect(result.current.error).toBeTruthy();
  expect(result.current.session).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
});

test('browser cancellation allows a clean retry', async () => {
  browser.mockResolvedValueOnce({ type: WebBrowser.WebBrowserResultType.CANCEL });
  const { result } = await setup();
  await act(() => result.current.signIn());
  expect(result.current).toMatchObject({ session: null, busy: false, error: null });
  await act(() => result.current.signIn());
  expect(result.current.session?.credential).toBeTruthy();
});

test.each([401, 403])('explains API denial after successful Authentik login (%s)', async status => {
  fetcher.mockImplementation(async (url: string) => url.endsWith('/api/bootstrap') ? response({}, status) : defaultFetch(url));
  const { result } = await setup();
  await act(() => result.current.signIn());
  expect(result.current.error).toContain('Authentik sign-in succeeded, but Worthfolio denied API access');
  expect(result.current.session).toBeNull();
  expect(save).not.toHaveBeenCalled();
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe(discovery.revocation_endpoint);
});

test('rapid repeated sign-in calls launch one browser session', async () => {
  const { result } = await setup();
  await act(async () => { await Promise.all([result.current.signIn(), result.current.signIn()]); });
  expect(browser).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

test.each(['expired', 'other-server', 'other-issuer', 'other-client', 'legacy'])('discards a saved %s credential', async mode => {
  getSaved.mockResolvedValue(JSON.stringify({ ...credential(), ...oidc,
    ...(mode === 'other-issuer' ? { issuer: 'https://other.test/' } : {}),
    ...(mode === 'other-client' ? { clientId: 'other-client' } : {}),
    ...(mode === 'legacy' ? { issuer: undefined, clientId: undefined } : {}),
    server: mode === 'other-server' ? 'https://elsewhere.test' : 'https://worthfolio.test',
    ...(mode === 'expired' ? { expiresAt: Date.now() / 1000 - 1 } : {}) }));
  const { result } = await setup();
  expect(result.current.session).toBeNull();
  expect(remove).toHaveBeenCalledTimes(1);
});

test('restores a valid saved credential and clears it on expiry', async () => {
  getSaved.mockResolvedValue(JSON.stringify({ server: 'https://worthfolio.test', ...oidc, ...credential() }));
  const { result } = await setup();
  expect(result.current.session?.credential).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(120_000); });
  expect(result.current.session).toBeNull();
  expect(remove).toHaveBeenCalledTimes(1);
});

test('sign-out revokes the access token at Authentik without cookies or a client secret', async () => {
  const { result } = await setup();
  await act(() => result.current.signIn());
  await act(() => result.current.signOut());
  expect(result.current.session).toBeNull();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls.at(-1)).toEqual([discovery.revocation_endpoint, expect.objectContaining({
    credentials: 'omit', method: 'POST', body: new URLSearchParams({
      client_id: oidc.clientId, token: 'test-mobile-token', token_type_hint: 'access_token',
    }).toString(),
  })]);
});

test('offline sign-out still clears local credentials', async () => {
  const { result } = await setup();
  await act(() => result.current.signIn());
  fetcher.mockRejectedValue(new Error('offline'));
  await act(() => result.current.signOut());
  expect(result.current.session).toBeNull();
  expect(result.current.error).toBeNull();
  expect(remove).toHaveBeenCalledTimes(1);
});

test('sign-out while the browser is open prevents a late callback from restoring access', async () => {
  let finish!: (result: WebBrowser.WebBrowserAuthSessionResult) => void;
  browser.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result } = await setup();
  let pending!: Promise<void>;
  act(() => { pending = result.current.signIn(); });
  await waitFor(() => expect(browser).toHaveBeenCalled());
  await act(() => result.current.signOut());
  await act(async () => { finish({ type: 'success', url: callback }); await pending; });
  expect(result.current.session).toBeNull();
  expect(WebBrowser.dismissAuthSession).toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
});

test('a failed secure-storage write does not activate the new session', async () => {
  save.mockRejectedValue(new Error('Secure storage unavailable'));
  const { result } = await setup();
  await act(() => result.current.signIn());
  expect(result.current.session).toBeNull();
  expect(result.current.error).toContain('Secure storage unavailable');
});

test.each([
  { issuer: 'https://other.test/' },
  { token_endpoint: 'https://attacker.test/token' },
  { authorization_endpoint: 'http://auth.test/authorize' },
  { revocation_endpoint: 'https://attacker.test/revoke' },
  { code_challenge_methods_supported: ['plain'] },
])('rejects mismatched or unsafe discovery before launching a browser: %j', async overrides => {
  fetcher.mockResolvedValue(response({ ...discovery, ...overrides }));
  const { result } = await setup();
  await act(() => result.current.signIn());
  expect(result.current.error).toBeTruthy();
  expect(browser).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

test.each([
  { access_token: '' }, { token_type: 'MAC' }, { expires_in: 0 }, { expires_in: -1 },
])('rejects unusable provider tokens: %j', async overrides => {
  fetcher.mockImplementation(async (url: string) => url === discovery.token_endpoint
    ? response({ ...tokenResponse, ...overrides }) : defaultFetch(url));
  const { result } = await setup();
  await act(() => result.current.signIn());
  expect(result.current.error).toContain('unsupported access token response');
  expect(result.current.session).toBeNull();
  expect(fetcher.mock.calls.some(([url]) => url.endsWith('/api/bootstrap'))).toBe(false);
});

test('does not surface provider response details on token exchange failure', async () => {
  fetcher.mockImplementation(async (url: string) => url === discovery.token_endpoint
    ? response({ error_description: 'sensitive-provider-detail' }, 400) : defaultFetch(url));
  const { result } = await setup();
  await act(() => result.current.signIn());
  expect(result.current.error).toContain('Authentik could not complete');
  expect(result.current.error).not.toContain('sensitive-provider-detail');
  expect(save).not.toHaveBeenCalled();
});

test('sign-out during bootstrap cancels the request and prevents saving a token', async () => {
  let finish!: (value: unknown) => void;
  let bootstrapSignal: AbortSignal | undefined;
  fetcher.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith('/api/bootstrap')) {
      bootstrapSignal = options.signal!;
      return new Promise(resolve => { finish = resolve; });
    }
    return defaultFetch(url);
  });
  const { result } = await setup();
  let pending!: Promise<void>;
  act(() => { pending = result.current.signIn(); });
  await waitFor(() => expect(bootstrapSignal).toBeDefined());
  await act(() => result.current.signOut());
  expect(bootstrapSignal?.aborted).toBe(true);
  await act(async () => { finish(response(sampleBootstrap)); await pending; });
  expect(result.current.session).toBeNull();
  expect(save).not.toHaveBeenCalled();
});
