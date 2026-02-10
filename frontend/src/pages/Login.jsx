import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { usePWAInstall } from '../usePWAInstall';
import { auth as authApi } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const { dark, toggleDark } = useTheme();
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user: u, token } = await authApi.login(email, password);
      login(u, token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-dvh flex flex-col justify-center px-4 sm:px-6 md:px-8 py-8 transition-colors duration-300"
      style={{ background: 'var(--bg)', paddingTop: 'max(2rem, env(safe-area-inset-top))' }}
    >
      <div className="fixed top-4 right-4 z-10 flex items-center gap-2">
        {isInstallable && !isInstalled && (
          <button
            type="button"
            onClick={install}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}
            title="Instalar como app"
          >
            <i className="fas fa-download mr-1" /> Instalar app
          </button>
        )}
        <button type="button" onClick={toggleDark} className="toggle-dark" title={dark ? 'Modo claro' : 'Modo oscuro'} />
      </div>
      <div
        className="w-full max-w-md mx-auto rounded-[24px] p-6 sm:p-8 animate-scale-in"
        style={{
          background: 'var(--header-bg)',
          backdropFilter: 'blur(20px)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--header-border)',
        }}
      >
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-3 mb-2">
            <img
              src="/logo.png"
              alt="APP Checklist"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-contain shadow-xl"
            />
            <span className="text-2xl font-extrabold text-[var(--primary)]">APP Checklist</span>
          </div>
          <p className="text-[var(--text-muted)]">Sistema de auditorías móviles</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[var(--text)] mb-1.5">Correo electrónico</label>
            <input
              type="email"
              placeholder="tu@empresa.com"
              className="input-audit"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--text)] mb-1.5">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              className="input-audit"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div className="p-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary w-full py-4" disabled={loading}>
            <i className="fas fa-sign-in-alt" />
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-[var(--text-muted)] space-y-1">
          <p><i className="fas fa-sync-alt mr-1" /> Sincronización automática</p>
          <p><i className="fas fa-database mr-1" /> Funciona sin conexión</p>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-4 opacity-80">
          Usuario: admin@uli.com / admin123
        </p>
      </div>
    </div>
  );
}
