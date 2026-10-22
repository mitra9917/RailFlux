import { NavLink, Outlet } from 'react-router-dom';
import { describeApiBaseUrl } from '../config/env';

export function AppLayout() {
  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header-inner">
          <div>
            <p className="eyebrow">RailFlux</p>
            <h1>Booking simulator</h1>
          </div>
          <nav className="site-nav" aria-label="Main">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
              Home
            </NavLink>
            <NavLink to="/compare" className={({ isActive }) => (isActive ? 'active' : undefined)}>
              Compare
            </NavLink>
            <NavLink to="/search" className={({ isActive }) => (isActive ? 'active' : undefined)}>
              Search
            </NavLink>
            <NavLink to="/book" className={({ isActive }) => (isActive ? 'active' : undefined)}>
              Book
            </NavLink>
          </nav>
        </div>
        <p className="muted api-base">
          API: <code>{describeApiBaseUrl()}</code>
        </p>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </div>
  );
}
