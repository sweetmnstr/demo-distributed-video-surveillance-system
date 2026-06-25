// Unit tests for components/console/Console.tsx
// Covers: line rendering, empty-submit guard, onSubmit call, input cleared after submit.

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
    render(<Console lines={SAMPLE_LINES} onSubmit={jest.fn()} />);

    expect(screen.getByText('> START_VIDEO')).toBeInTheDocument();
    expect(screen.getByText('< OK: video started')).toBeInTheDocument();
    expect(screen.getByText('< ERROR: unknown command')).toBeInTheDocument();
    expect(screen.getByText('! CONNECTION: disconnected')).toBeInTheDocument();
  });

  it('attaches the correct data-kind attribute to each line', () => {
    const { container } = render(<Console lines={SAMPLE_LINES} onSubmit={jest.fn()} />);
    const items = container.querySelectorAll('li');

    expect(items[0]).toHaveAttribute('data-kind', 'out');
    expect(items[1]).toHaveAttribute('data-kind', 'response');
    expect(items[2]).toHaveAttribute('data-kind', 'cmd-error');
    expect(items[3]).toHaveAttribute('data-kind', 'conn-error');
  });

  it('calls onSubmit with the trimmed input and clears the field', async () => {
    const onSubmit = jest.fn();
    render(<Console lines={[]} onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: /command/i });
    await userEvent.type(input, '  GET_STATUS  ');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(onSubmit).toHaveBeenCalledWith('GET_STATUS');
    expect(input).toHaveValue('');
  });

  it('does not call onSubmit when the input is blank or whitespace-only', async () => {
    const onSubmit = jest.fn();
    render(<Console lines={[]} onSubmit={onSubmit} />);

    // Submit without typing anything (empty string).
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onSubmit).not.toHaveBeenCalled();

    // Submit with whitespace only.
    await userEvent.type(screen.getByRole('textbox', { name: /command/i }), '   ');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders an empty list when no lines are provided', () => {
    const { container } = render(<Console lines={[]} onSubmit={jest.fn()} />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(0);
  });
});
