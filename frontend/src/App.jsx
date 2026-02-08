import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { sincronizarVisitasPendientes } from './sync';
import Layout from './Layout';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import NuevaVisita from './pages/NuevaVisita';
import VisitaDetalle from './pages/VisitaDetalle';
import Historial from './pages/Historial';
import Reportes from './pages/Reportes';
import Estructura from './pages/Estructura';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-dvh flex flex-col items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-10 h-10 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
      <p className="mt-4" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  useEffect(() => {
    const sync = () => sincronizarVisitasPendientes();
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Inicio />} />
        <Route path="nueva-visita" element={<NuevaVisita />} />
        <Route path="visita/:id" element={<VisitaDetalle />} />
        <Route path="historial" element={<Historial />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="estructura" element={<Estructura />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
