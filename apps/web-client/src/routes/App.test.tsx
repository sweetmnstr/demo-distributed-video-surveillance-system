// Unit tests for routes/App.tsx
// Strategy:
//   - AppRoutes (inner route tree) is tested under MemoryRouter for full
//     control over the URL without a real browser history.
//   - App (the BrowserRouter wrapper) is tested to cover the useState/callback
//     lines; jsdom supplies window.history so BrowserRouter works in tests.
// Mocks: auth-store, LoginScreen, MainScreen, DocsPage.

// The module-level `const authStore = createAuthStore()` in App.tsx executes
// when the module is first imported — before any beforeEach can set up a stub.
// We keep a mutable `sharedStub` whose state can be reset per-test. The
// factory always returns the *same object* (the module-load call and any later
// calls all see the same stub reference), so mutating `currentToken` controls
// what App's useState sees on each render.
// Note: variables referenced inside jest.mock factories MUST be prefixed with
// `mock` to be accessible after hoisting (ts-jest/babel-jest rule).
const mockSharedStub = (() => {
  let currentToken: string | null = null;
  return {
    setToken: (v: string): void => { currentToken = v; },
    getToken: (): string | null => currentToken,
    clear: (): void => { currentToken = null; },
    isAuthenticated: (): boolean => currentToken !== null,
    // Test helper: seed the token before a render without going through setToken.
    _seed: (v: string | null): void => { currentToken = v; },
  };
})();

jest.mock('../lib/auth-store', () => ({
  createAuthStore: jest.fn(() => mockSharedStub),
}));

jest.mock('../components/login/LoginScreen', () => ({
  // Stub exposes a button to invoke onAuthenticated with a predictable token.
  LoginScreen: ({ onAuthenticated }: { onAuthenticated: (t: string) => void }) => (
    <div data-testid="login-screen">
      <button onClick={() => onAuthenticated('stub-token')}>stub-sign-in</button>
    </div>
  ),
}));

jest.mock('../components/main/MainScreen', () => ({
  // Stub renders the token and exposes a logout button.
  MainScreen: ({ token, onLogout }: { token: string; onLogout: () => void }) => (
    <div data-testid="main-screen">
      <span>{token}</span>
      <button onClick={onLogout}>stub-logout</button>
    </div>
  ),
}));

jest.mock('./DocsPage', () => ({
  DocsPage: () => <div data-testid="docs-page" />,
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App, AppRoutes } from './App';

// Helper: render AppRoutes under MemoryRouter at the given path.
const renderAt = (
  path: string,
  token: string | null,
  onAuthenticated = jest.fn(),
  onLogout = jest.fn(),
) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes token={token} onAuthenticated={onAuthenticated} onLogout={onLogout} />
    </MemoryRouter>,
  );

afterEach(() => {
  jest.resetAllMocks();
  // Reset the shared auth stub to a clean state for the next test.
  mockSharedStub._seed(null);
});

describe('AppRoutes', () => {
  it('renders LoginScreen at /login when there is no token', () => {
    renderAt('/login', null);

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('redirects to / from /login when a token is present', () => {
    renderAt('/login', 'existing-jwt');

    // LoginScreen must NOT render; MainScreen should be shown (/ route).
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
    expect(screen.getByTestId('main-screen')).toBeInTheDocument();
  });

  it('renders MainScreen at / when a token is present', () => {
    renderAt('/', 'my-jwt');

    expect(screen.getByTestId('main-screen')).toBeInTheDocument();
    expect(screen.getByTestId('main-screen')).toHaveTextContent('my-jwt');
  });

  it('redirects to /login from / when there is no token', () => {
    renderAt('/', null);

    // MainScreen must NOT render; LoginScreen should be shown via redirect.
    expect(screen.queryByTestId('main-screen')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('renders DocsPage at /docs when unauthenticated', () => {
    renderAt('/docs', null);

    expect(screen.getByTestId('docs-page')).toBeInTheDocument();
  });

  it('renders DocsPage at /docs when authenticated', () => {
    renderAt('/docs', 'my-jwt');

    expect(screen.getByTestId('docs-page')).toBeInTheDocument();
  });
});

describe('App', () => {
  it('renders the login screen by default (no token in auth store)', () => {
    // BrowserRouter opens at "/" in jsdom; "/" redirects to /login when no token.
    render(<App />);

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('stores a token and shows MainScreen after onAuthenticated fires', async () => {
    render(<App />);

    // Stub LoginScreen calls onAuthenticated when its button is clicked.
    await userEvent.click(screen.getByRole('button', { name: /stub-sign-in/i }));

    expect(screen.getByTestId('main-screen')).toBeInTheDocument();
  });

  it('clears the token and shows LoginScreen again after onLogout fires', async () => {
    // Seed the shared stub with a token so App's useState initialises to non-null.
    mockSharedStub._seed('initial-token');

    render(<App />);

    expect(screen.getByTestId('main-screen')).toBeInTheDocument();

    // Stub MainScreen calls onLogout when its button is clicked.
    await userEvent.click(screen.getByRole('button', { name: /stub-logout/i }));

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });
});
