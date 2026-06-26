import { FormEvent, useState } from 'react';
import { login } from '../../api/login';

export const LoginScreen = ({ onAuthenticated }: { onAuthenticated: (token: string) => void }): JSX.Element => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    try {
      onAuthenticated(await login(name, password));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'login failed');
    }
  };

  return (
    <div className="login-page">
      <main className="login-card card" aria-labelledby="login-heading">
        <span className="brand brand--stack">
          <span className="brand__mark">FIXAR</span>
          <span className="brand__sub">Surveillance</span>
        </span>
        <h1 id="login-heading" className="login-card__title">Sign in</h1>
        <form className="login-form" onSubmit={submit}>
          <label className="field">
            <span className="field__label">Login</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span className="field__label">Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          <button type="submit" className="btn btn--primary login-form__submit">Sign in</button>
          {error && <p role="alert" className="alert">{error}</p>}
        </form>
      </main>
    </div>
  );
};
