import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NavBar } from './NavBar';

const renderNav = (ui: JSX.Element) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('NavBar', () => {
  it('renders each provided navigation link', () => {
    renderNav(<NavBar links={[{ label: 'Docs', to: '/docs' }]} />);
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
  });

  it('does not render a logout button when onLogout is omitted', () => {
    renderNav(<NavBar links={[{ label: 'Live', to: '/' }]} />);
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });

  it('renders a logout button that calls onLogout when clicked', async () => {
    const onLogout = jest.fn();
    renderNav(<NavBar links={[{ label: 'Docs', to: '/docs' }]} onLogout={onLogout} />);
    await userEvent.click(screen.getByRole('button', { name: /logout/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
