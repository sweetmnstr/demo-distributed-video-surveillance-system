import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Console } from './Console';
import { ConsoleLine } from '../../lib/console-log';

const SAMPLE_LINES: readonly ConsoleLine[] = [
  { kind: 'out', text: '> START_VIDEO' },
  { kind: 'response', text: '< OK: video started' },
  { kind: 'cmd-error', text: '< ERROR: unknown command' },
  { kind: 'conn-error', text: '! CONNECTION: disconnected' },
];

describe('Console', () => {
  it('renders all provided console lines', () => {
    render(<Console lines={SAMPLE_LINES} role="operator" onSubmit={jest.fn()} />);

    expect(screen.getByText('> START_VIDEO')).toBeInTheDocument();
    expect(screen.getByText('< OK: video started')).toBeInTheDocument();
    expect(screen.getByText('< ERROR: unknown command')).toBeInTheDocument();
    expect(screen.getByText('! CONNECTION: disconnected')).toBeInTheDocument();
  });

  it('attaches the correct data-kind attribute to each line', () => {
    const { container } = render(<Console lines={SAMPLE_LINES} role="operator" onSubmit={jest.fn()} />);
    const items = container.querySelectorAll('li');

    expect(items[0]).toHaveAttribute('data-kind', 'out');
    expect(items[1]).toHaveAttribute('data-kind', 'response');
    expect(items[2]).toHaveAttribute('data-kind', 'cmd-error');
    expect(items[3]).toHaveAttribute('data-kind', 'conn-error');
  });

  it('shows all four commands for operator role', () => {
    render(<Console lines={[]} role="operator" onSubmit={jest.fn()} />);
    const select = screen.getByRole('combobox', { name: /command/i }) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['START_VIDEO', 'STOP_VIDEO', 'GET_STATUS', 'LOGOUT']);
  });

  it('shows only GET_STATUS and LOGOUT for viewer role', () => {
    render(<Console lines={[]} role="viewer" onSubmit={jest.fn()} />);
    const select = screen.getByRole('combobox', { name: /command/i }) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['GET_STATUS', 'LOGOUT']);
  });

  it('calls onSubmit with the currently selected command', async () => {
    const onSubmit = jest.fn();
    render(<Console lines={[]} role="operator" onSubmit={onSubmit} />);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /command/i }), 'GET_STATUS');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(onSubmit).toHaveBeenCalledWith('GET_STATUS');
  });

  it('defaults to the first allowed command on submit without interaction', async () => {
    const onSubmit = jest.fn();
    render(<Console lines={[]} role="operator" onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(onSubmit).toHaveBeenCalledWith('START_VIDEO');
  });

  it('renders an empty list when no lines are provided', () => {
    const { container } = render(<Console lines={[]} role="operator" onSubmit={jest.fn()} />);
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });
});
