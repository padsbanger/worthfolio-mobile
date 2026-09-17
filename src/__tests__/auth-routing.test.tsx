import { Text } from 'react-native';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import AuthCallback from '../app/auth/callback';
import { useSession } from '../auth/session';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

type AuthState = Pick<ReturnType<typeof useSession>, 'session' | 'ready' | 'busy' | 'error'>;
const authContext = createContext<AuthState>({ session: null, ready: true, busy: false, error: null });
let updateAuth: (next: Partial<AuthState>) => void;

jest.mock('../auth/session', () => ({
  SessionProvider: ({ children }: PropsWithChildren) => children,
  useSession: jest.fn(),
}));

function SignIn() {
  const { error } = useSession();
  return <Text>{error || 'Sign in with Authentik'}</Text>;
}

function setup(initial: Partial<AuthState> = {}) {
  jest.mocked(useSession).mockImplementation(() => useContext(authContext) as ReturnType<typeof useSession>);
  function Wrapper({ children }: PropsWithChildren) {
    const [value, setValue] = useState<AuthState>({ session: null, ready: true, busy: false, error: null, ...initial });
    useEffect(() => { updateAuth = next => setValue(current => ({ ...current, ...next })); }, []);
    return <authContext.Provider value={value}>{children}</authContext.Provider>;
  }
  return renderRouter({
    _layout: RootLayout,
    'auth/callback': AuthCallback,
    'sign-in': SignIn,
    '(signed-in)/index': () => <Text>Account portfolio</Text>,
  }, { initialUrl: '/auth/callback?code=test-code&state=test-state', wrapper: Wrapper });
}

afterEach(() => jest.useRealTimers());

test('callback stays visible during exchange, then shows the API error on sign-in', async () => {
  const result = setup({ busy: true });
  expect(screen.getByText('Finishing sign-in')).toBeTruthy();
  expect(result.getPathname()).toBe('/auth/callback');
  act(() => updateAuth({ busy: false, error: 'Worthfolio denied API access.' }));
  await waitFor(() => expect(result.getPathname()).toBe('/sign-in'));
  expect(screen.getByText('Worthfolio denied API access.')).toBeTruthy();
  expect(result.getSearchParams()).not.toHaveProperty('code');
});

test('callback enters the portfolio only after authentication succeeds', async () => {
  const result = setup({ busy: true });
  expect(screen.getByText('Finishing sign-in')).toBeTruthy();
  act(() => updateAuth({ busy: false, session: { id: 1, demo: false,
    credential: { accessToken: 'test-token', tokenType: 'Bearer', expiresAt: Date.now() / 1000 + 60 } } }));
  await waitFor(() => expect(result.getPathname()).toBe('/'));
  expect(screen.getByText('Account portfolio')).toBeTruthy();
  expect(result.getSearchParams()).not.toHaveProperty('code');
});

test('a cold or stale callback offers recovery without trying the protected portfolio', async () => {
  const result = setup();
  expect(screen.getByText('Sign-in interrupted')).toBeTruthy();
  fireEvent.press(screen.getByText('Return to sign in'));
  await waitFor(() => expect(result.getPathname()).toBe('/sign-in'));
  expect(screen.getByText('Sign in with Authentik')).toBeTruthy();
});
