// Unit tests for routes/DocsPage.tsx
// The page renders a static architecture image (served from public/docs/),
// documents `npm run start` as the entrypoint, and contains no Docker content.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocsPage } from './DocsPage';

describe('DocsPage', () => {
  beforeEach(() => {
    render(<MemoryRouter><DocsPage /></MemoryRouter>);
  });

  it('shows a navbar link back to the live view', () => {
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

  it('renders the Architecture section heading', () => {
    expect(screen.getByRole('heading', { level: 2, name: /^architecture$/i })).toBeInTheDocument();
  });

  it('renders the Setup Instructions section heading', () => {
    expect(screen.getByRole('heading', { level: 2, name: /^setup instructions$/i })).toBeInTheDocument();
  });

  it('renders the Architectural Decisions section heading', () => {
    expect(screen.getByRole('heading', { level: 2, name: /^architectural decisions$/i })).toBeInTheDocument();
  });

  it('renders the Limitations section heading', () => {
    expect(screen.getByRole('heading', { level: 2, name: /^limitations$/i })).toBeInTheDocument();
  });

  it('renders the main landmark element', () => {
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders the architecture diagram figure', () => {
    expect(screen.getByTestId('architecture-diagram')).toBeInTheDocument();
  });

  it('renders the architecture image with the public PNG path and descriptive alt text', () => {
    const img = screen.getByRole('img', { name: /system architecture/i });
    expect(img).toHaveAttribute('src', '/docs/architecture.png');
  });

  it('documents `npm run start` as the entrypoint in Setup Instructions', () => {
    expect(screen.getByText(/npm run start/i)).toBeInTheDocument();
  });

  it('does not mention Docker anywhere on the page', () => {
    expect(screen.queryByText(/docker/i)).not.toBeInTheDocument();
  });
});
