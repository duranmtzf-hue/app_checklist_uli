import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { visitas as apiVisitas, regionales as apiReg } from '../api';
import { listarVisitasOffline, isOnline, getCache, setCache } from '../store';

export default function Historial() {
  const [visitas, setVisitas] = useState([]);
  const [offlineList, setOfflineList] = useState([]);
  const [regionales, setRegionales] = useState([]);
  const [filtroRegional, setFiltroRegional] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      if (isOnline()) {
        try {
          const [v, r] = await Promise.all([
            apiVisitas.list(filtroRegional ? { regional_id: filtroRegional } : {}),
            apiReg.list(),
          ]);
          setVisitas(v);
          setRegionales(r);
          await setCache('regionales', r);
        } catch (e) {
          const cachedReg = await getCache('regionales');
          setRegionales(cachedReg || []);
          setVisitas([]);
        }
      } else {
        const list = await listarVisitasOffline();
        setOfflineList(list);
        setVisitas([]);
        const cachedReg = await getCache('regionales');
        setRegionales(cachedReg || []);
      }
    } catch (e) {
      setVisitas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filtroRegional]);

  const list = isOnline()
    ? visitas
    : (filtroRegional
      ? offlineList.filter(v => {
          const reg = regionales.find(r => r.id === filtroRegional);
          return reg && v.regional_nombre === reg.nombre;
        })
      : offlineList);

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--text)]">Historial de visitas</h1>
        <p className="text-[var(--text-muted)] text-sm mt-0.5">Todas tus visitas registradas</p>
      </div>

      {regionales.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Filtrar por regional</label>
          <select className="select-audit w-full sm:w-auto min-w-[200px]" value={filtroRegional} onChange={(e) => setFiltroRegional(e.target.value)}>
            <option value="">Todas las regionales</option>
            {regionales.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
          <p className="text-[var(--text-muted)] mt-4">Cargando…</p>
        </div>
      ) : list.length === 0 ? (
        <div className="card-audit text-center py-12">
          <p className="text-[var(--text-muted)]">No hay visitas.</p>
          <Link to="/nueva-visita" className="btn btn-primary mt-4 inline-flex">Nueva visita</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map(v => (
            <li key={v.id}>
              {v.id.startsWith('offline-') ? (
                <div className="card-audit flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-[var(--text)]">{v.sucursal_nombre || 'Sucursal'}</span>
                    <span className="badge badge-warning ml-2">Offline</span>
                    <p className="text-[var(--text-muted)] text-sm mt-0.5">{v.regional_nombre} → {v.distrito_nombre}</p>
                  </div>
                </div>
              ) : (
                <Link to={`/visita/${v.id}`} className="card-audit block group hover:border-[var(--primary)] transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors">{v.sucursal_nombre}</span>
                      <p className="text-[var(--text-muted)] text-sm mt-0.5">{v.fecha} — {v.usuario_nombre}</p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5 opacity-80">{v.regional_nombre} → {v.distrito_nombre}</p>
                    </div>
                    <span className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors"><i className="fas fa-chevron-right" /></span>
                  </div>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
