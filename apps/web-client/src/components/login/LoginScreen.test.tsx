// Unit tests for components/login/LoginScreen.tsx
// Mocks: ../../api/login

jest.mock('../../api/login', () => ({ login: jest.fn() }));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { login } from '../../api/login';
import { LoginScreen } from './LoginScreen';

afterEach(() => jest.resetAllMocks());

describe('LoginScreen', () => {
  it('calls onAuthenticated with the token on success', async () => {
    (login as jest.Mock).mockResolvedValue('T');
    const onAuthenticated = jest.fn();

    render(<LoginScreen onAuthenticated={onAuthenticated} />);

    // The label text is "Login" — use getByRole to avoid matching the heading.
    await userEvent.type(screen.getByRole('textbox', { name: /^login$/i }), 'admin');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(onAuthenticated).toHaveBeenCalledWith('T');
  });

  it('shows an error alert on failure', async () => {
    (login as jest.Mock).mockRejectedValue(new Error('invalid login or password'));
    const onAuthenticated = jest.fn();

    render(<LoginScreen onAuthenticated={onAuthenticated} />);

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid login or password');
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('shows a fallback error message when the thrown value is not an Error', async () => {
    (login as jest.Mock).mockRejectedValue('unexpected string error');
    const onAuthenticated = jest.fn();

    render(<LoginScreen onAuthenticated={onAuthenticated} />);

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('login failed');
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});
