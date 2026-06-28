import { Link } from 'react-router-dom';

export interface NavLink {
  readonly label: string;
  readonly to: string;
}

export interface NavBarProps {
  readonly links: ReadonlyArray<NavLink>;
  readonly onLogout?: () => void;
}

// Shared top bar reused by the main screen and the docs page. The brand sits on
// the left; navigation links and an optional Logout button sit on the right.
export const NavBar = ({ links, onLogout }: NavBarProps): JSX.Element => (
  <header className="app-header navbar">
    <span className="brand">
      <span className="brand__mark">FIXAR</span>
      <span className="brand__sub">Surveillance</span>
    </span>
    <nav className="navbar__actions" aria-label="Primary">
      {links.map((link) => (
        <Link key={link.to} to={link.to} className="navbar__link">{link.label}</Link>
      ))}
      {onLogout && (
        <button type="button" className="btn btn--outline navbar__logout" onClick={onLogout}>
          Logout
        </button>
      )}
    </nav>
  </header>
);
