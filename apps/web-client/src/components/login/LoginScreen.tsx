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
    <main aria-labelledby="login-heading">
      <h1 id="login-heading">Surveillance Login</h1>
      <form onSubmit={submit}>
        <label>Login <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" /></label>
        <label>Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        <button type="submit">Sign in</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
};
