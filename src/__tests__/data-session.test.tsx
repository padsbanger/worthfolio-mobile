import { AppState, Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { DataProvider, useBootstrap } from '../api/data';
import { useSession } from '../auth/session';
import { sampleBootstrap } from '../fixtures/portfolio';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('../lib/config', () => ({ server: { url: 'https://worthfolio.test' } }));
jest.mock('../auth/session', () => ({ useSession: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: (listener: (state: unknown) => void) => {
    listener({ isConnected: true, isInternetReachable: true });
    return () => {};
  },
}));

const originalFetch = global.fetch;
const originalAppState = AppState.currentState;
const expire = jest.fn();
let currentSession: ReturnType<typeof useSession>['session'];

function Probe() {
  const query = useBootstrap();
  return <Text>{query.data?.account.name ?? 'Loading account'}</Text>;
}

// Mirrors the root guard and signed-in layout's session-keyed DataProvider.
function Boundary() {
  return currentSession ? <DataProvider key={currentSession.id}><Probe /></DataProvider> : <Text>Signed out</Text>;
}

function session(id: number) {
  return { id, demo: false, credential: { accessToken: `token-${id}`, tokenType: 'Bearer' as const, expiresAt: Date.now() / 1000 + 120 } };
}

function response(name: string) {
  return { ok: true, status: 200, json: async () => ({ ...sampleBootstrap, account: { ...sampleBootstrap.account, name } }) };
}

beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  currentSession = session(1);
  expire.mockReset();
  jest.mocked(useSession).mockImplementation(() => ({ session: currentSession, expire,
    ready: true, busy: false, error: null, signIn: async () => {}, signOut: async () => {}, explore: () => {},
  }));
});
afterEach(() => {
  global.fetch = originalFetch;
  AppState.currentState = originalAppState;
  jest.useRealTimers();
});

test('logout removes loaded account data and a new session starts with a separate cache', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce(response('First account'));
  global.fetch = fetcher;
  const view = render(<Boundary />);
  expect(await screen.findByText('First account')).toBeTruthy();
  currentSession = null;
  view.rerender(<Boundary />);
  expect(screen.getByText('Signed out')).toBeTruthy();
  expect(screen.queryByText('First account')).toBeNull();
  let complete!: (value: unknown) => void;
  fetcher.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  currentSession = session(2);
  view.rerender(<Boundary />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('First account')).toBeNull();
  expect(screen.getByText('Loading account')).toBeTruthy();
  await act(async () => complete(response('Second account')));
  expect(await screen.findByText('Second account')).toBeTruthy();
  expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer token-2');
});

test.each([200, 401])('a late response from an old account (%s) cannot overwrite or expire a new session', async status => {
  let complete!: (value: unknown) => void;
  const fetcher = jest.fn().mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
    .mockResolvedValue(response('Second account'));
  global.fetch = fetcher;
  const view = render(<Boundary />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  const oldSignal = fetcher.mock.calls[0][1].signal as AbortSignal;
  currentSession = session(2);
  view.rerender(<Boundary />);
  expect(oldSignal.aborted).toBe(true);
  expect(await screen.findByText('Second account')).toBeTruthy();
  await act(async () => complete(status === 200 ? response('First account') : { ok: false, status }));
  expect(screen.getByText('Second account')).toBeTruthy();
  expect(screen.queryByText('First account')).toBeNull();
  expect(expire).not.toHaveBeenCalled();
});
