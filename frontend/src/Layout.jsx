import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { usePWAInstall } from './usePWAInstall';
import { isOnline } from './store';

const navLeft = [
  { to: '/', label: 'Inicio', icon: 'fa-home' },
  { to: '/historial', label: 'Historial', icon: 'fa-history' },
];
const navRight = [
  { to: '/reportes', label: 'Reportes', icon: 'fa-chart-bar' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggleDark } = useTheme();
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const rightNav = [
    ...navRight,
    ...(user?.role === 'admin' || user?.role === 'regional' ? [{ to: '/estructura', label: 'Estructura', icon: 'fa-sitemap' }] : []),
  ];
  const avatarInitials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="min-h-dvh transition-colors duration-300" style={{ background: 'var(--bg)' }}>
      <header
        className="fixed top-0 left-0 right-0 z-20 px-4 py-3 flex items-center justify-between transition-colors duration-300"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          background: 'var(--header-bg)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.08)',
          borderBottom: '1px solid var(--header-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}
          >
            <i className="fas fa-clipboard-check" />
          </div>
          <span className="font-extrabold text-lg text-[var(--primary)]">APP Checklist</span>
        </div>
        <div className="flex items-center gap-2">
          {isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={install}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}
              title="Instalar como app"
            >
              <i className="fas fa-download" /> Instalar app
            </button>
          )}
          <button
            type="button"
            onClick={toggleDark}
            className="toggle-dark shrink-0"
            title={dark ? 'Modo claro' : 'Modo oscuro'}
          />
          {!isOnline() && (
            <span
              className="px-2.5 py-1 rounded-xl text-xs font-semibold text-white"
              style={{ background: 'var(--warning)' }}
              title="Sin conexión"
            >
              <i className="fas fa-wifi-slash mr-1" /> Offline
            </span>
          )}
          <span className="text-[var(--text-muted)] text-sm hidden sm:inline max-w-[100px] truncate">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[var(--text)] hover:bg-[var(--border)] transition-colors touch-manipulation"
          >
            <i className="fas fa-sign-out-alt" />
          </button>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
          >
            {avatarInitials}
          </div>
        </div>
      </header>

      <main className="pt-[4.5rem] md:pt-[4.5rem] pb-28 md:pb-24 max-w-[600px] mx-auto px-4 sm:px-6 md:px-8" style={{ paddingTop: 'max(4.5rem, calc(4.5rem + env(safe-area-inset-top)))', paddingBottom: 'max(6rem, calc(6rem + env(safe-area-inset-bottom)))' }}>
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 px-2 py-3 flex justify-around items-end max-w-[600px] mx-auto transition-colors duration-300"
        style={{
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          background: 'var(--header-bg)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.08)',
          borderTop: '1px solid var(--header-border)',
        }}
      >
        {navLeft.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 flex-1 min-h-[56px] py-2 transition-colors touch-manipulation active:opacity-80 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
            <i className={`fas ${icon} text-xl`} />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
        <NavLink to="/nueva-visita" className="flex flex-col items-center justify-center flex-1 min-h-[56px] -mt-4 group touch-manipulation active:opacity-90">
          <div className="w-14 h-14 md:w-12 md:h-12 rounded-[14px] flex items-center justify-center text-white transition-transform group-hover:scale-105 group-active:scale-95" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', boxShadow: '0 6px 20px rgba(67,97,238,0.4)' }}>
            <i className="fas fa-plus text-lg" />
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)] mt-1">Nueva</span>
        </NavLink>
        {rightNav.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 flex-1 min-h-[56px] py-2 transition-colors touch-manipulation active:opacity-80 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
            <i className={`fas ${icon} text-xl`} />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
