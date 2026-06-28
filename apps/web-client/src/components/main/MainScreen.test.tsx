// Unit tests for components/main/MainScreen.tsx
// Mocks:
//   ../../api/control-socket  — openControlSocket returns a socket stub
//   @vss/shared               — parseCommand stubbed to control ok/err results
//   ../video/VideoView        — replaced with a no-op to avoid MSE/WebSocket overhead
//
// Written to be extensible for Task 21 (encryption wiring).

jest.mock('../../api/control-socket', () => ({
  openControlSocket: jest.fn(),
}));

jest.mock('../../api/encrypt', () => ({
  createEncryptor: jest.fn(),
}));

// Mock VideoView so MSE/WebSocket plumbing from VideoView does not run in jsdom.
jest.mock('../video/VideoView', () => ({
  VideoView: () => <div data-testid="video-view" />,
}));

// We need the real parseCommand behaviour, but we also need to spy on it.
// Re-export everything from the real module so other named exports still work.
jest.mock('@vss/shared', () => {
  const actual = jest.requireActual<typeof import('@vss/shared')>('@vss/shared');
  return { ...actual, parseCommand: jest.fn() };
});

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { openControlSocket } from '../../api/control-socket';
import { parseCommand } from '@vss/shared';
import { createEncryptor } from '../../api/encrypt';
import { MainScreen } from './MainScreen';

// Shared socket stub — recreated before each test.
type OnResponse = (ok: boolean, text: string) => void;
type OnConnectionError = (text: string) => void;

interface SocketStub {
  send: jest.Mock;
  sendEncrypted: jest.Mock;
  close: jest.Mock;
  // Expose captured handlers so tests can trigger server callbacks.
  _onResponse: OnResponse;
  _onConnectionError: OnConnectionError;
}

const makeSocketStub = (): SocketStub => {
  const stub: Partial<SocketStub> = {
    send: jest.fn(),
    sendEncrypted: jest.fn(),
    close: jest.fn(),
  };
  (openControlSocket as jest.Mock).mockImplementation(
    (_token: string, handlers: { onResponse: OnResponse; onConnectionError: OnConnectionError }) => {
      stub._onResponse = handlers.onResponse;
      stub._onConnectionError = handlers.onConnectionError;
      return stub;
    },
  );
  return stub as SocketStub;
};

// Wraps MainScreen in a MemoryRouter because NavBar renders <Link> which
// requires a router context; without it every render would throw.
const renderMain = (props: { token: string; onLogout: () => void }) =>
  render(<MemoryRouter><MainScreen {...props} /></MemoryRouter>);

// Default: encryptor unavailable — tests that need encryption set their own mock.
beforeEach(() => {
  (createEncryptor as jest.Mock).mockRejectedValue(new Error('no key'));
});

afterEach(() => jest.resetAllMocks());

describe('MainScreen', () => {
  it('opens a control socket on mount with the provided token', () => {
    makeSocketStub();
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'GET_STATUS' });

    renderMain({ token: 'my-jwt', onLogout: jest.fn() });

    expect(openControlSocket).toHaveBeenCalledWith('my-jwt', expect.objectContaining({
      onResponse: expect.any(Function),
      onConnectionError: expect.any(Function),
    }));
  });

  it('offers operator-only commands when the token encodes the operator role', () => {
    makeSocketStub();
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'GET_STATUS' });

    // A token whose payload decodes to role=operator exercises decodeRole's success path.
    const payload = btoa(JSON.stringify({ role: 'operator' }));
    renderMain({ token: `header.${payload}.sig`, onLogout: jest.fn() });

    expect(screen.getByRole('option', { name: 'START_VIDEO' })).toBeInTheDocument();
  });

  it('adds an outgoing line and calls socket.send on a valid command', async () => {
    makeSocketStub();
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'START_VIDEO' });

    renderMain({ token: 'tok', onLogout: jest.fn() });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /command/i }), 'GET_STATUS');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText('> START_VIDEO')).toBeInTheDocument();

    // The actual stub was created before render — retrieve via mock.results.
    const actualStub = (openControlSocket as jest.Mock).mock.results[0]?.value as SocketStub;
    expect(actualStub.send).toHaveBeenCalledWith('START_VIDEO');
  });

  it('adds an error line and does not send when parseCommand returns an error', async () => {
    makeSocketStub();
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'err', error: 'unknown command: NOPE' });

    renderMain({ token: 'tok', onLogout: jest.fn() });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /command/i }), 'GET_STATUS');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText('< ERROR: unknown command: NOPE')).toBeInTheDocument();
    const actualStub = (openControlSocket as jest.Mock).mock.results[0]?.value as SocketStub;
    expect(actualStub.send).not.toHaveBeenCalled();
  });

  it('adds an incoming response line when the server replies with ok=true', async () => {
    const stub = makeSocketStub();
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'GET_STATUS' });

    renderMain({ token: 'tok', onLogout: jest.fn() });

    act(() => stub._onResponse(true, 'video running'));

    expect(await screen.findByText('< OK: video running')).toBeInTheDocument();
  });

  it('adds an error line when the server replies with ok=false', async () => {
    const stub = makeSocketStub();
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'GET_STATUS' });

    renderMain({ token: 'tok', onLogout: jest.fn() });

    act(() => stub._onResponse(false, 'not authorised'));

    expect(await screen.findByText('< ERROR: not authorised')).toBeInTheDocument();
  });

  it('adds a connection-error line when the socket reports an error', async () => {
    const stub = makeSocketStub();

    renderMain({ token: 'tok', onLogout: jest.fn() });

    act(() => stub._onConnectionError('server unreachable'));

    expect(await screen.findByText('! CONNECTION: server unreachable')).toBeInTheDocument();
  });

  it('closes the socket on unmount', () => {
    makeSocketStub();

    const { unmount } = renderMain({ token: 'tok', onLogout: jest.fn() });
    const actualStub = (openControlSocket as jest.Mock).mock.results[0]?.value as SocketStub;

    act(() => unmount());

    expect(actualStub.close).toHaveBeenCalledTimes(1);
  });

  it('encrypts commands when a key is available', async () => {
    const stub = makeSocketStub();
    const encrypt = jest.fn().mockResolvedValue('CIPHER');
    (createEncryptor as jest.Mock).mockResolvedValue(encrypt);
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'GET_STATUS' });

    renderMain({ token: 'tok', onLogout: jest.fn() });

    // Wait for the createEncryptor promise to resolve and the ref to be populated.
    await act(async () => {
      await Promise.resolve();
    });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /command/i }), 'GET_STATUS');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    // Wait for the async handleSubmit to complete.
    await act(async () => {
      await Promise.resolve();
    });

    expect(stub.sendEncrypted).toHaveBeenCalledWith('CIPHER');
    expect(stub.send).not.toHaveBeenCalled();
  });

  it('falls back to plaintext when the encryptor fails to initialize', async () => {
    const stub = makeSocketStub();
    (createEncryptor as jest.Mock).mockRejectedValue(new Error('no key'));
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'GET_STATUS' });

    renderMain({ token: 'tok', onLogout: jest.fn() });

    // Wait for the rejected createEncryptor promise to settle.
    await act(async () => {
      await Promise.resolve();
    });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /command/i }), 'GET_STATUS');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(stub.send).toHaveBeenCalledWith('GET_STATUS');
    expect(stub.sendEncrypted).not.toHaveBeenCalled();
  });

  it('falls back to plaintext when the encrypt call itself throws', async () => {
    const stub = makeSocketStub();
    // Encryptor initializes fine but then throws when called.
    const encrypt = jest.fn().mockRejectedValue(new Error('encrypt failed'));
    (createEncryptor as jest.Mock).mockResolvedValue(encrypt);
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'GET_STATUS' });

    renderMain({ token: 'tok', onLogout: jest.fn() });

    // Wait for createEncryptor to resolve and populate the ref.
    await act(async () => {
      await Promise.resolve();
    });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /command/i }), 'GET_STATUS');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    // Wait for the rejected encrypt() call and the catch fallback to settle.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stub.sendEncrypted).not.toHaveBeenCalled();
    expect(stub.send).toHaveBeenCalledWith('GET_STATUS');
  });

  it('hides the video and shows a stopped placeholder after STOP_VIDEO', async () => {
    makeSocketStub();
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'STOP_VIDEO' });

    renderMain({ token: 'tok', onLogout: jest.fn() });
    expect(screen.getByTestId('video-view')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /command/i }), 'GET_STATUS');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.queryByTestId('video-view')).not.toBeInTheDocument();
    expect(screen.getByText(/video stopped/i)).toBeInTheDocument();
  });

  it('shows the video again after START_VIDEO', async () => {
    makeSocketStub();
    const parse = parseCommand as jest.Mock;

    renderMain({ token: 'tok', onLogout: jest.fn() });

    parse.mockReturnValue({ kind: 'ok', value: 'STOP_VIDEO' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /command/i }), 'GET_STATUS');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(screen.queryByTestId('video-view')).not.toBeInTheDocument();

    parse.mockReturnValue({ kind: 'ok', value: 'START_VIDEO' });
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(screen.getByTestId('video-view')).toBeInTheDocument();
  });

  it('logout button sends LOGOUT over the socket and calls onLogout', async () => {
    const stub = makeSocketStub();
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'GET_STATUS' });
    const onLogout = jest.fn();

    renderMain({ token: 'tok', onLogout });

    await userEvent.click(screen.getByRole('button', { name: /logout/i }));

    expect(stub.send).toHaveBeenCalledWith('LOGOUT');
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('logging out from the command dropdown tears down like the button', async () => {
    const stub = makeSocketStub();
    (parseCommand as jest.Mock).mockReturnValue({ kind: 'ok', value: 'LOGOUT' });
    const onLogout = jest.fn();

    renderMain({ token: 'tok', onLogout });

    const select = screen.getByLabelText('command');
    await userEvent.selectOptions(select, 'LOGOUT');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(stub.send).toHaveBeenCalledWith('LOGOUT');
    expect(stub.close).toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalled();
    expect(screen.queryByTestId('video-view')).not.toBeInTheDocument();
  });
});
