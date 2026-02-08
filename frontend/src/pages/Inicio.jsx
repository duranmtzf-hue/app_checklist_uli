import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { visitas as apiVisitas } from '../api';
import { isOnline, listarVisitasOffline } from '../store';

export default function Inicio() {
  const [visitas, setVisitas] = useState([]);
  const [stats, setStats] = useState({ total: 0, cumplimiento: 0 });

  useEffect(() => {
    const load = async () => {
      if (isOnline()) {
        try {
          const list = await apiVisitas.list();
          setVisitas(list.slice(0, 5));
          setStats({ total: list.length, cumplimiento: list.length ? 85 : 0 });
        } catch {
          const offline = await listarVisitasOffline();
          setVisitas(offline.slice(0, 5));
          setStats({ total: offline.length, cumplimiento: 0 });
        }
      } else {
        const offline = await listarVisitasOffline();
        setVisitas(offline.slice(0, 5));
        setStats({ total: offline.length, cumplimiento: 0 });
      }
    };
    load();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buen día';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const quickActions = [
    { to: '/nueva-visita', icon: 'fa-plus', label: 'Nueva visita', color: 'primary' },
    { to: '/reportes', icon: 'fa-chart-line', label: 'Reportes', color: 'success' },
    { to: '/historial', icon: 'fa-history', label: 'Historial', color: 'warning' },
  ];

  return (
    <div className="space-y-6 pb-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--text)] mb-1">{greeting()}</h1>
        <p className="text-[var(--text-muted)]">Tienes <strong className="text-[var(--primary)]">{visitas.length}</strong> visitas recientes</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-audit group">
          <div className="flex justify-between items-start mb-2">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[var(--primary)]" style={{ background: 'rgba(67,97,238,0.1)' }}>
              <i className="fas fa-store" />
            </div>
            <span className="text-xs font-semibold text-[var(--success)]"><i className="fas fa-arrow-up mr-0.5" /> Activo</span>
          </div>
          <div className="text-2xl font-extrabold text-[var(--text)] transition-transform group-hover:scale-105">{stats.total}</div>
          <div className="text-sm text-[var(--text-muted)] font-medium">Visitas registradas</div>
        </div>
        <div className="card-audit group">
          <div className="flex justify-between items-start mb-2">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[var(--success)] transition-transform group-hover:scale-110" style={{ background: 'rgba(74,222,128,0.2)' }}>
              <i className="fas fa-check-circle" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[var(--text)] transition-transform group-hover:scale-105">{stats.cumplimiento}%</div>
          <div className="text-sm text-[var(--text-muted)] font-medium">Cumplimiento</div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-[var(--text)] mb-3">Acciones rápidas</h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map(({ to, icon, label, color }, i) => (
            <Link key={to} to={to} className="card-audit flex flex-col items-center gap-2 py-4 text-center group transition-transform hover:scale-[1.02]" style={{ animationDelay: `${i * 50}ms` }}>
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center text-white transition-transform group-hover:scale-110"
                style={{
                  background: color === 'primary' ? 'linear-gradient(135deg, var(--primary), var(--primary-light))' :
                    color === 'success' ? 'linear-gradient(135deg, var(--success), #22c55e)' :
                    'linear-gradient(135deg, var(--warning), #eab308)',
                }}
              >
                <i className={`fas ${icon}`} />
              </div>
              <span className="text-xs font-semibold text-[var(--text)]">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="card-audit">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-[var(--text)]">Visitas recientes</h2>
          <Link to="/historial" className="badge-audit badge-primary hover:opacity-90 transition-opacity">Ver todo</Link>
        </div>
        {visitas.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No hay visitas. <Link to="/nueva-visita" className="text-[var(--primary)] font-semibold hover:underline">Crear una</Link></p>
        ) : (
          <div className="space-y-1">
            {visitas.map((v, i) => (
              v.id?.startsWith('offline-') ? (
                <Link key={v.id} to={`/visita/${v.id}`} className="flex justify-between items-center p-3 rounded-xl transition-colors hover:bg-[var(--border)]">
                  <div>
                    <div className="font-bold text-[var(--text)]">{v.sucursal_nombre || 'Sucursal'}</div>
                    <div className="text-sm text-[var(--text-muted)] flex gap-3 items-center">
                      <span className="badge badge-warning text-xs">Offline</span>
                      {v.regional_nombre && <span>{v.regional_nombre} → {v.distrito_nombre}</span>}
                    </div>
                  </div>
                  <i className="fas fa-chevron-right text-[var(--primary)]" />
                </Link>
              ) : (
              <Link
                key={v.id}
                to={`/visita/${v.id}`}
                className="flex justify-between items-center p-3 rounded-xl transition-colors hover:bg-[var(--border)]"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div>
                  <div className="font-bold text-[var(--text)]">{v.sucursal_nombre}</div>
                  <div className="text-sm text-[var(--text-muted)] flex gap-3">
                    <span><i className="far fa-calendar mr-1" />{v.fecha?.slice(0, 10)}</span>
                    <span><i className="fas fa-user mr-1" />{v.usuario_nombre}</span>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-[var(--primary)]" />
              </Link>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
