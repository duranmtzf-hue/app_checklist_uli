import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { regionales as apiReg, distritos as apiDist, reportes as apiReportes } from '../api';
import { getCache, setCache, isOnline } from '../store';

const CACHE_REG = 'regionales';

export default function Reportes() {
  const [regionales, setRegionales] = useState([]);
  const [distritosList, setDistritosList] = useState([]);
  const [tipo, setTipo] = useState('regional');
  const [id, setId] = useState('');
  const [regionalForDistrito, setRegionalForDistrito] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comparar, setComparar] = useState([]);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    (async () => {
      if (isOnline()) {
        const r = await apiReg.list();
        setRegionales(r);
        await setCache(CACHE_REG, r);
      } else {
        const r = await getCache(CACHE_REG);
        setRegionales(r || []);
      }
    })();
  }, []);

  useEffect(() => {
    if (!id || !isOnline()) return;
    setLoading(true);
    setData(null);
    if (tipo === 'regional') {
      apiReportes.regional(id).then(setData).finally(() => setLoading(false));
    } else if (tipo === 'distrito') {
      apiReportes.distrito(id).then(setData).finally(() => setLoading(false));
    } else if (tipo === 'sucursal') {
      apiReportes.sucursal(id).then(setData).finally(() => setLoading(false));
    }
  }, [tipo, id]);

  useEffect(() => {
    if (!isOnline()) return;
    apiReportes.comparar(tipo === 'regional' && id ? { regional_id: id } : {}).then(setComparar);
  }, [id, tipo]);

  useEffect(() => {
    if (!isOnline()) return;
    apiReportes.historial(id ? { regional_id: id } : {}).then(setHistorial);
  }, [id]);

  useEffect(() => {
    if (tipo !== 'distrito' || !regionalForDistrito || !isOnline()) return;
    apiDist.list(regionalForDistrito).then(setDistritosList);
  }, [tipo, regionalForDistrito]);

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--text)]">Reportes</h1>
        <p className="text-[var(--text-muted)] text-sm mt-0.5">Resúmenes por regional, distrito y sucursal</p>
      </div>

      <div className="card-audit space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Ver por</label>
          <select className="select-audit w-full" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="regional">Resumen por regional</option>
            <option value="distrito">Resumen por distrito</option>
            <option value="sucursal">Resumen por sucursal</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Seleccionar</label>
          {tipo === 'regional' && (
            <select className="select-audit w-full" value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">— Regional —</option>
              {regionales.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          )}
          {tipo === 'distrito' && (
            <>
              <select className="select-audit w-full mb-3" value={regionalForDistrito} onChange={(e) => { setRegionalForDistrito(e.target.value); setId(''); }}>
                <option value="">— Regional —</option>
                {regionales.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              <select className="select-audit w-full" value={id} onChange={(e) => setId(e.target.value)} disabled={!regionalForDistrito}>
                <option value="">— Distrito —</option>
                {distritosList.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </>
          )}
          {tipo === 'sucursal' && (
            <select className="select-audit w-full" value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">— Sucursal —</option>
              {comparar.map(s => <option key={s.id} value={s.id}>{s.sucursal_nombre} ({s.distrito_nombre})</option>)}
            </select>
          )}
        </div>
      </div>

      {tipo === 'regional' && id && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
            </div>
          ) : data && (
            <div className="card-audit">
              <h2 className="font-semibold text-lg text-[var(--text)]">{data.regional?.nombre}</h2>
              <p className="text-[var(--text-muted)] text-sm mt-0.5">{data.visitas?.length ?? 0} visitas en esta regional</p>
              <ul className="mt-4 space-y-2">
                {(data.visitas || []).slice(0, 10).map(v => (
                  <li key={v.id} className="flex justify-between items-center py-2 border-b border-[var(--border)] last:border-0">
                    <Link to={`/visita/${v.id}`} className="font-medium" style={{ color: 'var(--primary)' }}>{v.sucursal_nombre}</Link>
                    <span className="text-[var(--text-muted)] text-sm">{v.fecha?.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {tipo === 'distrito' && id && data && (
        <div className="card-audit">
          <h2 className="font-semibold text-lg text-[var(--text)]">{data.distrito?.nombre}</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{data.visitas?.length ?? 0} visitas</p>
          <ul className="mt-4 space-y-2">
            {(data.visitas || []).slice(0, 10).map(v => (
              <li key={v.id}><Link to={`/visita/${v.id}`} className="font-medium" style={{ color: 'var(--primary)' }}>{v.sucursal_nombre}</Link> — <span className="text-[var(--text-muted)] text-sm">{v.fecha?.slice(0, 10)}</span></li>
            ))}
          </ul>
        </div>
      )}

      {tipo === 'sucursal' && id && data && (
        <div className="card-audit">
          <h2 className="font-semibold text-lg text-[var(--text)]">{data.sucursal?.nombre}</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{data.visitas?.length ?? 0} visitas</p>
          <ul className="mt-4 space-y-2">
            {(data.visitas || []).map(v => (
              <li key={v.id}><Link to={`/visita/${v.id}`} className="font-medium" style={{ color: 'var(--primary)' }}>{v.fecha} — {v.usuario_nombre}</Link></li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h2 className="font-semibold text-[var(--text)] mb-3">Comparación entre sucursales</h2>
        {!isOnline() ? <p className="text-[var(--text-muted)] text-sm">Disponible con conexión</p> : (
          <ul className="space-y-2">
            {comparar.slice(0, 15).map(s => (
              <li key={s.id} className="card-audit flex justify-between items-center">
                <span className="font-semibold text-[var(--text)]">{s.sucursal_nombre}</span>
                <span className="badge badge-muted">{s.total_visitas} visitas</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-[var(--text)] mb-3">Historial reciente</h2>
        {!isOnline() ? <p className="text-[var(--text-muted)] text-sm">Disponible con conexión</p> : (
          <ul className="space-y-2">
            {historial.slice(0, 20).map(v => (
              <li key={v.id}>
                <Link to={`/visita/${v.id}`} className="card-audit block py-2.5 px-3 font-medium hover:border-[var(--primary)] transition-colors" style={{ color: 'var(--primary)' }}>
                  {v.sucursal_nombre} — {v.fecha?.slice(0, 10)} — {v.usuario_nombre}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
