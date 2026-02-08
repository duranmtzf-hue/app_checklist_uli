import { useState, useEffect } from 'react';
import { regionales as apiReg, distritos as apiDist, sucursales as apiSuc } from '../api';
import { useAuth } from '../AuthContext';
import { isOnline } from '../store';

export default function Estructura() {
  const { user } = useAuth();
  const [regionales, setRegionales] = useState([]);
  const [distritos, setDistritos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([apiReg.list(), apiDist.list(), apiSuc.list()])
      .then(([r, d, s]) => {
        setRegionales(r);
        setDistritos(d);
        setSucursales(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isOnline()) load(); }, []);

  const canEdit = user?.role === 'admin' || user?.role === 'regional';

  const handleCreateRegional = async (e) => {
    e.preventDefault();
    try {
      await apiReg.create({ nombre: form.nombre });
      setModal(null);
      setForm({});
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateDistrito = async (e) => {
    e.preventDefault();
    const nombre = form.nombre === '_otro' ? form.nombreCustom : form.nombre;
    if (!nombre?.trim()) return alert('Nombre requerido');
    try {
      await apiDist.create({ regional_id: form.regional_id, nombre: nombre.trim() });
      setModal(null);
      setForm({});
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateSucursal = async (e) => {
    e.preventDefault();
    try {
      await apiSuc.create({ distrito_id: form.distrito_id, nombre: form.nombre, direccion: form.direccion });
      setModal(null);
      setForm({});
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteRegional = async (r) => {
    if (!confirm(`¿Eliminar regional "${r.nombre}"? Se eliminarán sus distritos y sucursales.`)) return;
    setDeleting(r.id);
    try {
      await apiReg.delete(r.id);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteDistrito = async (d) => {
    if (!confirm(`¿Eliminar distrito "${d.nombre}"? Se eliminarán sus sucursales.`)) return;
    setDeleting(d.id);
    try {
      await apiDist.delete(d.id);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteSucursal = async (s) => {
    if (!confirm(`¿Eliminar sucursal "${s.nombre}"?`)) return;
    setDeleting(s.id);
    try {
      await apiSuc.delete(s.id);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (!isOnline()) {
    return (
      <div className="card-audit text-center py-12">
        <p className="text-[var(--text-muted)]">Estructura solo disponible con conexión.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--text)]">Estructura del negocio</h1>
        <p className="text-[var(--text-muted)] text-sm mt-0.5">Regionales, distritos y sucursales</p>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
          <p className="text-[var(--text-muted)] mt-4">Cargando…</p>
        </div>
      ) : (
        <>
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[var(--text)]">Regionales</h2>
              {canEdit && (
                <button type="button" onClick={() => setModal({ type: 'regional' })} className="btn btn-primary text-sm py-2"><i className="fas fa-plus" /> Nueva</button>
              )}
            </div>
            <ul className="space-y-2">
              {regionales.map(r => (
                <li key={r.id} className="card-audit py-3 px-4 flex items-center justify-between gap-3">
                  <span className="font-semibold text-[var(--text)]">{r.nombre}</span>
                  {canEdit && (
                    <button type="button" onClick={() => handleDeleteRegional(r)} disabled={deleting === r.id} className="p-2 rounded-lg text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
                      <i className={`fas ${deleting === r.id ? 'fa-spinner fa-spin' : 'fa-trash-alt'}`} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[var(--text)]">Distritos</h2>
              {canEdit && (
                <button type="button" onClick={() => setModal({ type: 'distrito' })} className="btn btn-primary text-sm py-2"><i className="fas fa-plus" /> Nuevo</button>
              )}
            </div>
            <ul className="space-y-2">
              {distritos.map(d => (
                <li key={d.id} className="card-audit py-3 px-4 flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)] text-sm">{d.regional_nombre || regionales.find(r => r.id === d.regional_id)?.nombre} → {d.nombre}</span>
                  {canEdit && (
                    <button type="button" onClick={() => handleDeleteDistrito(d)} disabled={deleting === d.id} className="p-2 rounded-lg text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0" title="Eliminar">
                      <i className={`fas ${deleting === d.id ? 'fa-spinner fa-spin' : 'fa-trash-alt'}`} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[var(--text)]">Sucursales</h2>
              {canEdit && (
                <button type="button" onClick={() => setModal({ type: 'sucursal' })} className="btn btn-primary text-sm py-2"><i className="fas fa-plus" /> Nueva</button>
              )}
            </div>
            <ul className="space-y-2">
              {sucursales.map(s => (
                <li key={s.id} className="card-audit py-3 px-4 flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)] text-sm truncate">{s.regional_nombre} → {s.distrito_nombre} → {s.nombre}</span>
                  {canEdit && (
                    <button type="button" onClick={() => handleDeleteSucursal(s)} disabled={deleting === s.id} className="p-2 rounded-lg text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0" title="Eliminar">
                      <i className={`fas ${deleting === s.id ? 'fa-spinner fa-spin' : 'fa-trash-alt'}`} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {modal?.type === 'regional' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-30">
          <div className="card-audit max-w-sm w-full border-2" style={{ borderColor: 'rgba(67,97,238,0.3)' }}>
            <h3 className="font-semibold text-[var(--text)] mb-4">Nueva regional</h3>
            <form onSubmit={handleCreateRegional}>
              <input className="input-audit mb-4" placeholder="Nombre" value={form.nombre ?? ''} onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))} required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal(null)} className="btn btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === 'distrito' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-30">
          <div className="card-audit max-w-sm w-full border-2" style={{ borderColor: 'rgba(67,97,238,0.3)' }}>
            <h3 className="font-semibold text-[var(--text)] mb-4">Nuevo distrito</h3>
            <form onSubmit={handleCreateDistrito}>
              <select className="select-audit mb-4" value={form.regional_id ?? ''} onChange={(e) => setForm(f => ({ ...f, regional_id: e.target.value }))} required>
                <option value="">Regional</option>
                {regionales.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Distrito</label>
              <select
                className="select-audit mb-4"
                value={form.nombre ?? ''}
                onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))}
                required
              >
                <option value="">— Seleccionar distrito —</option>
                <option value="Distrito 01 - Tijuana, Tecate, Rosarito">Distrito 01 - Tijuana, Tecate, Rosarito</option>
                <option value="Distrito 02 - Ensenada">Distrito 02 - Ensenada</option>
                <option value="Distrito 03 - Tijuana">Distrito 03 - Tijuana</option>
                <option value="Distrito 04 - Mexicali">Distrito 04 - Mexicali</option>
                <option value="Distrito 05 - Mexicali, SLRC">Distrito 05 - Mexicali, SLRC</option>
                <option value="Distrito 06 - Nogales, Obregón, Puerto Peñasco">Distrito 06 - Nogales, Obregón, Puerto Peñasco</option>
                <option value="Distrito 07 - BCS">Distrito 07 - BCS</option>
                <option value="Distrito 08 - Culiacán y Guasave">Distrito 08 - Culiacán y Guasave</option>
                <option value="Distrito 09 - Mazatlán y Tepic">Distrito 09 - Mazatlán y Tepic</option>
                <option value="Distrito 10 - Durango y Torreón">Distrito 10 - Durango y Torreón</option>
                <option value="_otro">Otro (escribir abajo)</option>
              </select>
              {form.nombre === '_otro' && (
                <input className="input-audit mb-4" placeholder="Nombre del distrito" value={form.nombreCustom ?? ''} onChange={(e) => setForm(f => ({ ...f, nombreCustom: e.target.value }))} required />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal(null)} className="btn btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === 'sucursal' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-30">
          <div className="card-audit max-w-sm w-full border-2" style={{ borderColor: 'rgba(67,97,238,0.3)' }}>
            <h3 className="font-semibold text-[var(--text)] mb-4">Nueva sucursal</h3>
            <form onSubmit={handleCreateSucursal}>
              <select className="select-audit mb-4" value={form.distrito_id ?? ''} onChange={(e) => setForm(f => ({ ...f, distrito_id: e.target.value }))} required>
                <option value="">Distrito</option>
                {distritos.map(d => <option key={d.id} value={d.id}>{d.nombre} ({regionales.find(r => r.id === d.regional_id)?.nombre})</option>)}
              </select>
              <input className="input-audit mb-4" placeholder="Nombre de la sucursal" value={form.nombre ?? ''} onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))} required />
              <input className="input-audit mb-4" placeholder="Dirección (opcional)" value={form.direccion ?? ''} onChange={(e) => setForm(f => ({ ...f, direccion: e.target.value }))} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal(null)} className="btn btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
