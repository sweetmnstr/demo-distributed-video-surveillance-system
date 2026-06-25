import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createAuthStore } from '../lib/auth-store';
import { LoginScreen } from '../components/login/LoginScreen';
import { MainScreen } from '../components/main/MainScreen';
import { DocsPage } from './DocsPage';

const authStore = createAuthStore();

export interface AppRoutesProps {
  token: string | null;
  onAuthenticated: (value: string) => void;
  onLogout: () => void;
}

/** Inner route tree — exported so tests can mount it under MemoryRouter. */
export const AppRoutes = ({ token, onAuthenticated, onLogout }: AppRoutesProps): JSX.Element => (
  <Routes>
    <Route path="/docs" element={<DocsPage />} />
    <Route path="/" element={token ? <MainScreen token={token} onLogout={onLogout} /> : <Navigate to="/login" replace />} />
    <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginScreen onAuthenticated={onAuthenticated} />} />
  </Routes>
);

export const App = (): JSX.Element => {
  const [token, setToken] = useState<string | null>(authStore.getToken());
  const authenticate = (value: string): void => { authStore.setToken(value); setToken(value); };
  const logout = (): void => { authStore.clear(); setToken(null); };

  return (
    <BrowserRouter>
      <AppRoutes token={token} onAuthenticated={authenticate} onLogout={logout} />
    </BrowserRouter>
  );
};
