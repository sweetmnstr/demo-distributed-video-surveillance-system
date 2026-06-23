import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createAuthStore } from '../lib/auth-store';
import { LoginScreen } from '../components/login/LoginScreen';
import { MainScreen } from '../components/main/MainScreen';
import { DocsPage } from './DocsPage';

const authStore = createAuthStore();

export const App = (): JSX.Element => {
  const [token, setToken] = useState<string | null>(authStore.getToken());
  const authenticate = (value: string): void => { authStore.setToken(value); setToken(value); };
  const logout = (): void => { authStore.clear(); setToken(null); };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/" element={token ? <MainScreen token={token} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginScreen onAuthenticated={authenticate} />} />
      </Routes>
    </BrowserRouter>
  );
};
