import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import DateBar from './DateBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';

const NAV = [
  { to: '/', label: 'Today', icon: 'today', end: true },
  { to: '/gym', label: 'Gym', icon: 'gym' },
  { to: '/meals', label: 'Meals', icon: 'meals' },
  { to: '/water', label: 'Water', icon: 'water' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
];
const DATED = ['/', '/gym', '/meals', '/water'];

export default function AppShell() {
  const { user } = useAuth();
  const { date, isToday } = useUi();
  const { pathname, search } = useLocation();
  const keep = isToday ? '' : `?date=${date}`; // keep the chosen day when switching tabs
  const dated = DATED.includes(pathname);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <img src="/icon-192.png" alt="" width="36" height="36" />
          <span>FitCoach</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={`${n.to}${DATED.includes(n.to) ? keep : ''}`} end={n.end} className="side-link">
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </NavLink>
          ))}
          <NavLink to="/settings" className="side-link">
            <Icon name="settings" />
            <span>Settings</span>
          </NavLink>
        </nav>
        <p className="side-user">Signed in as {user?.name}</p>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="topbar-brand">
            <img src="/icon-192.png" alt="" width="30" height="30" />
            <span>FitCoach</span>
          </div>
          {dated && <DateBar />}
          <NavLink to={`/settings${search}`} className="icon-btn topbar-settings" aria-label="Settings">
            <Icon name="settings" />
          </NavLink>
        </header>
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="tabbar" aria-label="Main navigation">
        {NAV.map((n) => (
          <NavLink key={n.to} to={`${n.to}${DATED.includes(n.to) ? keep : ''}`} end={n.end} className="tab">
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
