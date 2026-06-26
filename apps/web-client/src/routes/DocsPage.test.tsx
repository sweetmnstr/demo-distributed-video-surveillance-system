// Unit tests for routes/DocsPage.tsx
// Verifies all section headings present in the current implementation,
// plus the Architecture (Mermaid), Setup Instructions, and Architectural
// Decisions sections added in Task 19.

const mockMermaid = {
  initialize: jest.fn(),
  render: jest.fn().mockResolvedValue({ svg: '<svg data-mocked="true"/>' }),
};

jest.mock('mermaid', () => mockMermaid);

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import mermaid from 'mermaid';
import { DocsPage, runMermaidEffect } from './DocsPage';

// mermaid.initialize is called once at module import time (I1 fix).
// The mock is set up before import, so the call count starts at 1.
afterEach(() => jest.clearAllMocks());

describe('runMermaidEffect', () => {
  it('skips render when el is null', () => {
    runMermaidEffect(null);

    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it('calls mermaid.render and sets innerHTML when el is provided', async () => {
    const el = document.createElement('div');

    runMermaidEffect(el);

    await waitFor(() => {
      expect(mermaid.render).toHaveBeenCalledWith('vss-diagram', expect.stringContaining('flowchart'));
      expect(el.innerHTML).toContain('<svg');
    });
  });

  it('logs an error and does not throw when mermaid.render rejects', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const renderError = new Error('mermaid render failed');
    (mermaid.render as jest.Mock).mockRejectedValueOnce(renderError);

    const el = document.createElement('div');
    runMermaidEffect(el);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DocsPage] mermaid.render failed:',
        renderError,
      );
    });
    consoleSpy.mockRestore();
  });
});

describe('DocsPage', () => {
  beforeEach(() => {
    render(<MemoryRouter><DocsPage /></MemoryRouter>);
  });

  it('shows a navbar link back to the live view', () => {
    // beforeEach has already rendered; no second render needed.
    expect(screen.getByRole('link', { name: 'Live' })).toHaveAttribute('href', '/');
  });

  it('renders the top-level heading', () => {
    expect(screen.getByRole('heading', { level: 1, name: /architecture & docs/i })).toBeInTheDocument();
  });

  it('renders the Overview section heading', () => {
    expect(screen.getByRole('heading', { level: 2, name: /^overview$/i })).toBeInTheDocument();
  });

  it('renders the Technologies section heading', () => {
    expect(screen.getByRole('heading', { level: 2, name: /^technologies$/i })).toBeInTheDocument();
  });

  it('renders the Limitations section heading', () => {
    expect(screen.getByRole('heading', { level: 2, name: /^limitations$/i })).toBeInTheDocument();
  });

  it('renders the main landmark element', () => {
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  // Task 19 assertions — new sections
  it('renders the Architecture section heading', () => {
    expect(screen.getByRole('heading', { name: /^architecture$/i })).toBeInTheDocument();
  });

  it('renders the architecture diagram container', () => {
    expect(screen.getByTestId('architecture-diagram')).toBeInTheDocument();
  });

  it('renders the Setup Instructions section heading', () => {
    expect(screen.getByRole('heading', { name: /^setup instructions$/i })).toBeInTheDocument();
  });

  it('renders the Architectural Decisions section heading', () => {
    expect(screen.getByRole('heading', { name: /^architectural decisions$/i })).toBeInTheDocument();
  });

  it('injects mermaid SVG into the diagram container after render', async () => {
    await waitFor(() => {
      const container = screen.getByTestId('architecture-diagram');
      expect(container.innerHTML).toContain('<svg');
    });
  });
});
