import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { regionales as apiReg, distritos as apiDist, sucursales as apiSuc, checklist as apiCheck, visitas as apiVisitas, upload as apiUpload } from '../api';
import { useAuth } from '../AuthContext';
import { isOnline, guardarVisitaOffline, getCache, setCache, guardarDraftOffline, obtenerDraftOffline, limpiarDraftOffline } from '../store';

const CACHE_KEY_REG = 'regionales';
const CACHE_KEY_PLANTILLA = 'checklist_plantilla_v4';
const cacheDistritosKey = (regionalId) => `distritos_${regionalId}`;
const cacheSucursalesKey = (distritoId) => `sucursales_${distritoId}`;

const SECTIONS = [
  { id: 'datos', title: 'Información General', desc: 'Complete los datos de la visita', icon: 'fa-clipboard' },
  { id: 'prework', title: 'Pre-work Indicadores', desc: 'Llenar antes de entrar a piso', icon: 'fa-chart-line' },
  { id: 'financiera', title: 'Validación Financiera', desc: 'Confrontar datos Arguilea con realidad', icon: 'fa-money-check-alt' },
  { id: 'calidad', title: 'Calidad y Experiencia', desc: 'Causas raíz de quejas Qualtrics', icon: 'fa-hamburger' },
  { id: 'mantenimiento', title: 'Mantenimiento e Imagen', desc: 'Soporte a la Venta', icon: 'fa-tools' },
  { id: 'rh', title: 'Recursos Humanos', desc: 'Productividad', icon: 'fa-users' },
  { id: 'delivery', title: 'Delivery y Agregadores', desc: 'Control fraude y venta perdida', icon: 'fa-motorcycle' },
  { id: 'marketing', title: 'Mercadotecnia', desc: 'Campañas, precios y licencias', icon: 'fa-bullhorn' },
  { id: 'plan-accion', title: 'Plan de Acción', desc: 'Acciones correctivas', icon: 'fa-tasks' },
  { id: 'resumen', title: 'Resumen y Envío', desc: 'Revise y envíe', icon: 'fa-file-export' },
];

const SECTION_MAP = {
  datos: ['Datos de la Visita'],
  prework: ['1. Ventas', '1A. Pre-work: Satisfacción (Qualtrics)', '1B. Pre-work: Costos y Control (Arguilea)'],
  financiera: ['2. Validación Financiera en Campo'],
  calidad: ['3. Calidad y Experiencia (Qualtrics)'],
  mantenimiento: ['4. Mantenimiento e Imagen'],
  rh: ['5. Recursos Humanos'],
  delivery: ['6. Delivery y Agregadores'],
  marketing: ['7A. Mercadotecnia: Precios y Menú Board', '7B. Mercadotecnia: Material P.O.P.', '7C. Mercadotecnia: Juguetes (King Jr)', '7D. Mercadotecnia: Promociones y Cupones', 'Otros'],
};

const FOTO_SUCURSAL_ITEM = { id: 'dato-foto-sucursal', titulo: 'Evidencia fotográfica de la sucursal', tipo: 'foto', obligatorio: 0 };

export default function NuevaVisita() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [section, setSection] = useState('datos');
  const [regionales, setRegionales] = useState([]);
  const [distritos, setDistritos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [plantilla, setPlantilla] = useState([]);
  const [selected, setSelected] = useState({ regional: null, distrito: null, sucursal: null });
  const [respuestas, setRespuestas] = useState({});
  const [gerente, setGerente] = useState('');
  const [planFinanciero, setPlanFinanciero] = useState('');
  const [planExperiencia, setPlanExperiencia] = useState('');
  const [planOperativo, setPlanOperativo] = useState('');
  const [fotos, setFotos] = useState({});
  const [fotoUploading, setFotoUploading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftVisitaId, setDraftVisitaId] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isOnline()) {
        try {
          const [reg, plant] = await Promise.all([apiReg.list(), apiCheck.plantilla()]);
          setRegionales(reg || []);
          setPlantilla(plant || []);
          await setCache(CACHE_KEY_REG, reg);
          await setCache(CACHE_KEY_PLANTILLA, plant);
        } catch (e) {
          const reg = await getCache(CACHE_KEY_REG);
          const plant = await getCache(CACHE_KEY_PLANTILLA);
          setRegionales(reg || []);
          setPlantilla(plant || []);
          setError(e.message || 'Error al cargar. Usando datos en caché.');
        }
      } else {
        const reg = await getCache(CACHE_KEY_REG);
        const plant = await getCache(CACHE_KEY_PLANTILLA);
        setRegionales(reg || []);
        setPlantilla(plant || []);
        if (!reg?.length) setError('Sin conexión. Conecta para cargar.');
      }
    } catch (e) {
      setError(e.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [section]);

  useEffect(() => {
    if (!isOnline() && plantilla.length > 0) {
      obtenerDraftOffline().then((d) => {
        if (d?.selected?.sucursal) {
          setSelected(d.selected);
          setRespuestas(d.respuestas || {});
          setGerente(d.gerente || '');
          setPlanFinanciero(d.planFinanciero || '');
          setPlanExperiencia(d.planExperiencia || '');
          setPlanOperativo(d.planOperativo || '');
        }
      });
    }
  }, [isOnline(), plantilla.length]);

  useEffect(() => {
    if (!selected.regional) {
      setDistritos([]);
      setSucursales([]);
      return;
    }
    const loadDistritos = async () => {
      if (isOnline()) {
        try {
          const d = await apiDist.list(selected.regional);
          setDistritos(d || []);
          await setCache(cacheDistritosKey(selected.regional), d || []);
        } catch (e) {
          const cached = await getCache(cacheDistritosKey(selected.regional));
          setDistritos(cached || []);
        }
      } else {
        const cached = await getCache(cacheDistritosKey(selected.regional));
        setDistritos(cached || []);
      }
    };
    loadDistritos();
    setSelected(s => ({ ...s, distrito: null, sucursal: null }));
  }, [selected.regional]);

  useEffect(() => {
    if (!selected.distrito) { setSucursales([]); return; }
    const loadSucursales = async () => {
      if (isOnline()) {
        try {
          const s = await apiSuc.list({ distrito_id: selected.distrito });
          setSucursales(s || []);
          await setCache(cacheSucursalesKey(selected.distrito), s || []);
        } catch (e) {
          const cached = await getCache(cacheSucursalesKey(selected.distrito));
          setSucursales(cached || []);
        }
      } else {
        const cached = await getCache(cacheSucursalesKey(selected.distrito));
        setSucursales(cached || []);
      }
    };
    loadSucursales();
    setSelected(s => ({ ...s, sucursal: null }));
  }, [selected.distrito]);

  const reg = regionales.find(r => r.id === selected.regional);
  const dist = distritos.find(d => d.id === selected.distrito);
  const suc = sucursales.find(s => s.id === selected.sucursal);

  const setResp = (itemId, field, value) => {
    setRespuestas(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [field]: value } }));
  };

  const buildRespuestas = () => {
    const base = plantilla.map(item => ({
      item_id: item.id,
      valor_si_no: item.tipo === 'si_no' ? (respuestas[item.id]?.valor_si_no === 1 || respuestas[item.id]?.valor_si_no === true ? 1 : respuestas[item.id]?.valor_si_no === 0 || respuestas[item.id]?.valor_si_no === false ? 0 : null) : null,
      valor_texto: item.tipo === 'texto' ? respuestas[item.id]?.valor_texto : null,
      valor_numero: (item.tipo === 'numero' || item.tipo === 'estatus') ? (respuestas[item.id]?.valor_numero != null ? Number(respuestas[item.id].valor_numero) : null) : null,
      valor_porcentaje: item.tipo === 'porcentaje' ? (respuestas[item.id]?.valor_porcentaje != null ? Number(respuestas[item.id].valor_porcentaje) : null) : null,
      valor_foto_path: item.tipo === 'foto' ? (fotos[item.id] && !String(fotos[item.id]).startsWith('blob:') ? fotos[item.id] : null) : null,
      observaciones: respuestas[item.id]?.observaciones ?? null,
    }));
    const tieneFotoSucursal = base.some(r => r.item_id === 'dato-foto-sucursal');
    if (!tieneFotoSucursal) {
      base.unshift({
        item_id: 'dato-foto-sucursal',
        valor_si_no: null,
        valor_texto: null,
        valor_numero: null,
        valor_porcentaje: null,
        valor_foto_path: fotos['dato-foto-sucursal'] && !String(fotos['dato-foto-sucursal']).startsWith('blob:') ? fotos['dato-foto-sucursal'] : null,
        observaciones: respuestas['dato-foto-sucursal']?.observaciones ?? null,
      });
    }
    return base;
  };

  const buildPayload = (estado = 'completada') => ({
    sucursal_id: selected.sucursal,
    fecha: new Date().toISOString().slice(0, 19).replace('T', ' '),
    gerente: gerente || null,
    plan_accion: null,
    plan_financiero: planFinanciero || null,
    plan_experiencia: planExperiencia || null,
    plan_operativo: planOperativo || null,
    respuestas: buildRespuestas(),
    estado,
  });

  const handleGuardar = async () => {
    if (!selected.sucursal) {
      setToast({ msg: 'Seleccione sucursal para guardar', type: 'warning' });
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (!isOnline()) {
      try {
        await guardarDraftOffline({ selected, respuestas, gerente, planFinanciero, planExperiencia, planOperativo });
        setToast({ msg: 'Borrador guardado localmente. Envíe cuando termine.', type: 'success' });
      } catch (e) {
        setToast({ msg: 'Error al guardar borrador', type: 'danger' });
      }
      setTimeout(() => setToast(null), 2500);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (draftVisitaId) {
        const payload = buildPayload('borrador');
        await apiVisitas.update(draftVisitaId, payload);
        setToast({ msg: 'Progreso actualizado', type: 'success' });
      } else {
        const payload = buildPayload('borrador');
        const visita = await apiVisitas.create(payload);
        setDraftVisitaId(visita.id);
        setToast({ msg: 'Progreso guardado', type: 'success' });
      }
    } catch (e) {
      setError(e.message || 'Error al guardar');
      setToast({ msg: e.message || 'Error', type: 'danger' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleSubmit = async () => {
    if (!selected.sucursal) {
      setToast({ msg: 'Seleccione sucursal', type: 'warning' });
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (progress < MIN_PROGRESS_PERCENT) {
      setToast({ msg: 'Complete al menos el 80% del checklist para enviar', type: 'warning' });
      setTimeout(() => setToast(null), 2500);
      return;
    }
    setSaving(true);
    setError('');
    const payload = buildPayload('completada');
    try {
      if (isOnline()) {
        if (draftVisitaId) {
          await apiVisitas.update(draftVisitaId, payload);
          navigate(`/visita/${draftVisitaId}`);
        } else {
          const visita = await apiVisitas.create(payload);
          navigate(`/visita/${visita.id}`);
        }
      } else {
        const id = 'offline-' + Date.now();
        const respuestasEnriquecidas = (payload.respuestas || []).map((r) => {
          const item = plantilla.find((p) => p.id === r.item_id);
          return { ...r, id: r.item_id, titulo: item?.titulo ?? '', tipo: item?.tipo ?? 'texto', observaciones: r.observaciones };
        });
        await guardarVisitaOffline({
          id,
          ...payload,
          respuestas: respuestasEnriquecidas,
          sucursal_nombre: suc?.nombre,
          distrito_nombre: dist?.nombre,
          regional_nombre: reg?.nombre,
        });
        await limpiarDraftOffline();
        setToast({ msg: 'Guardado offline. Se sincronizará con conexión.', type: 'success' });
        setTimeout(() => navigate('/historial'), 2000);
      }
    } catch (e) {
      setError(e.message || 'Error al guardar');
      setToast({ msg: e.message || 'Error', type: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const getItemsForSection = (secId) => {
    const secciones = SECTION_MAP[secId];
    if (!secciones) return [];
    return plantilla.filter(p => secciones.includes(p.seccion || 'Otros'));
  };

  const renderItem = (item) => {
    const r = respuestas[item.id] || {};
    return (
      <div key={item.id} className="chk-item">
        <label className="chk-label">{item.titulo} {item.obligatorio ? <span className="chk-req">*</span> : ''}</label>
        {item.tipo === 'si_no' && (
          <div className="chk-sino">
            <label className="chk-radio"><input type="radio" name={item.id} checked={r.valor_si_no === 1} onChange={() => setResp(item.id, 'valor_si_no', 1)} /> Sí</label>
            <label className="chk-radio"><input type="radio" name={item.id} checked={r.valor_si_no === 0} onChange={() => setResp(item.id, 'valor_si_no', 0)} /> No</label>
          </div>
        )}
        {item.tipo === 'texto' && (
          item.id === 'c1-8' || item.id === 'c9'
            ? <textarea className="chk-input" placeholder="Escriba aquí..." value={r.valor_texto ?? ''} onChange={e => setResp(item.id, 'valor_texto', e.target.value)} rows={3} />
            : <input type="text" className="chk-input" placeholder="Escriba aquí..." value={r.valor_texto ?? ''} onChange={e => setResp(item.id, 'valor_texto', e.target.value)} />
        )}
        {item.tipo === 'numero' && (
          <input type="number" className="chk-input chk-input-sm" placeholder={item.titulo.includes('Temp') ? '°F' : item.titulo.includes('Tiempo') ? 'min' : item.titulo.includes('Inventario') || item.titulo.includes('Días') ? 'días' : '#'} value={r.valor_numero ?? ''} onChange={e => setResp(item.id, 'valor_numero', e.target.value)} />
        )}
        {item.tipo === 'estatus' && (
          <div className="chk-estatus">
            {[1, 2, 3].map(n => (
              <label key={n} className="chk-est-btn"><input type="radio" name={'e-' + item.id} checked={r.valor_numero === n} onChange={() => setResp(item.id, 'valor_numero', n)} />{n === 1 ? '🟢' : n === 2 ? '🟡' : '🔴'}</label>
            ))}
          </div>
        )}
        {item.tipo === 'porcentaje' && (
          <input type="number" min="0" max="100" step="0.1" className="chk-input chk-input-sm" placeholder="%" value={r.valor_porcentaje ?? ''} onChange={e => setResp(item.id, 'valor_porcentaje', e.target.value)} />
        )}
        {item.tipo === 'foto' && (
          <div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="chk-input py-2 text-sm"
              disabled={fotoUploading === item.id}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFotoUploading(item.id);
                try {
                  if (isOnline()) {
                    const { path: p } = await apiUpload.foto(f);
                    setFotos(prev => ({ ...prev, [item.id]: p }));
                  } else {
                    setFotos(prev => ({ ...prev, [item.id]: URL.createObjectURL(f) }));
                    setResp(item.id, 'valor_foto_path', null);
                  }
                } catch (err) {
                  setToast({ msg: err.message || 'Error al subir imagen', type: 'danger' });
                } finally {
                  setFotoUploading(null);
                }
              }}
            />
            {fotos[item.id] && (
              <div className="mt-2 relative">
                <img
                  src={typeof fotos[item.id] === 'string' && !fotos[item.id].startsWith('blob:') ? `/${fotos[item.id]}` : fotos[item.id]}
                  alt="Evidencia"
                  className="rounded-xl max-h-36 object-cover border border-[var(--border)]"
                />
                {fotoUploading === item.id && <span className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl text-white text-sm"><i className="fas fa-spinner fa-spin" /></span>}
              </div>
            )}
          </div>
        )}
        <input type="text" className="chk-input chk-obs" placeholder="Observaciones (opcional)" value={r.observaciones ?? ''} onChange={e => setResp(item.id, 'observaciones', e.target.value)} />
      </div>
    );
  };

  const MIN_PROGRESS_PERCENT = 80;
  const currentSectionInfo = SECTIONS.find(s => s.id === section);
  const progress = plantilla.length ? Math.round((plantilla.filter(p => {
    const r = respuestas[p.id];
    if (p.tipo === 'si_no') return r?.valor_si_no != null;
    if (p.tipo === 'texto') return (r?.valor_texto?.trim()?.length ?? 0) > 0;
    if (p.tipo === 'numero' || p.tipo === 'porcentaje') return r?.valor_numero != null || r?.valor_porcentaje != null;
    if (p.tipo === 'estatus') return r?.valor_numero != null;
    if (p.tipo === 'foto') return !!(fotos[p.id] || (r?.valor_foto_path && String(r.valor_foto_path).trim()));
    return false;
  }).length / plantilla.length) * 100) : 0;
  const canSubmit = progress >= MIN_PROGRESS_PERCENT;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-fade-in" style={{ color: 'var(--text-muted)' }}>
        <div className="w-12 h-12 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
        <p className="mt-4">Cargando checklist…</p>
      </div>
    );
  }

  return (
    <div className="chk-app space-y-6 animate-fade-in" style={{ background: 'var(--bg)' }}>
      <style>{`
        .chk-app { --chk-blue: #4F46E5; --chk-blue-dark: #4338CA; --chk-gold: #D4AF37; --chk-gold-light: #F0D878; --chk-success: #10B981; }
        .chk-app .chk-section-title { color: var(--chk-blue); }
        .chk-app .chk-item { background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 14px; border: 1px solid var(--border-subtle); }
        .chk-app .chk-item:hover { border-color: var(--border); }
        .chk-app .chk-label { font-weight: 600; color: var(--text); display: block; margin-bottom: 10px; }
        .chk-app .chk-req { color: var(--danger); }
        .chk-app .chk-input { width: 100%; padding: 12px 14px; min-height: 44px; border: 2px solid var(--border); border-radius: var(--radius-sm); font-size: 16px; background: var(--bg-elevated); color: var(--text); }
        .chk-app .chk-input:focus { outline: none; border-color: var(--chk-blue); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }
        .chk-app .chk-input-sm { width: 120px; min-width: 120px; }
        .chk-app .chk-obs { margin-top: 10px; font-size: 16px; }
        .chk-app .chk-sino, .chk-app .chk-estatus { display: flex; gap: 16px; flex-wrap: wrap; }
        .chk-app .chk-radio, .chk-app .chk-est-btn { display: flex; align-items: center; gap: 10px; cursor: pointer; min-height: 44px; padding: 4px 0; -webkit-tap-highlight-color: transparent; }
        .chk-app .chk-est-btn input { accent-color: var(--chk-blue); }
        .chk-app .chk-card { background: var(--bg-elevated); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow); border: 1px solid var(--border-subtle); border-left: 3px solid var(--chk-gold); }
      `}</style>

      <div className="card-audit flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ borderLeft: '3px solid var(--chk-gold)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white shadow-lg" style={{ background: 'linear-gradient(135deg, var(--chk-blue), var(--chk-blue-dark))' }}>
            <i className="fas fa-crown" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Checklist BK</h1>
            <p className="text-sm text-[var(--text-muted)] flex items-center gap-1">
              <i className="fas fa-map-marker-alt" /> {reg?.nombre || 'Seleccione regional'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>Progreso</span><span className="font-semibold">{progress}%</span>
            </div>
            <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--chk-gold), var(--chk-gold-light))' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 pb-2 min-w-max sm:flex-wrap sm:min-w-0">
          {SECTIONS.map(s => (
            <button key={s.id} type="button" onClick={() => setSection(s.id)} className={`shrink-0 px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 touch-manipulation active:opacity-90 ${section === s.id ? 'text-white shadow-md' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--border)]'}`} style={section === s.id ? { background: 'linear-gradient(135deg, var(--chk-blue), var(--chk-blue-dark))' } : {}} aria-label={`Ir a ${s.title}`}>
              <i className={`fas ${s.icon}`} /><span className="hidden sm:inline">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pb-2">
        <h2 className="text-lg font-bold text-[var(--text)]">{currentSectionInfo?.title}</h2>
        <p className="text-sm text-[var(--text-muted)]">{currentSectionInfo?.desc}</p>
      </div>

      <div>
          {error && <div className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }}><i className="fas fa-exclamation-triangle" />{error}</div>}

          {section === 'datos' && (
            <div className="chk-card card-audit space-y-6">
              <h3 className="chk-section-title font-bold flex items-center gap-2 mb-4"><i className="fas fa-clipboard-list" /> Datos de la Visita</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-[var(--text)] mb-2">Regional *</label>
                  <select className="chk-input" value={selected.regional || ''} onChange={e => setSelected(s => ({ ...s, regional: e.target.value || null }))}>
                    <option value="">Seleccione</option>
                    {regionales.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text)] mb-2">Distrito *</label>
                  <select className="chk-input" value={selected.distrito || ''} onChange={e => setSelected(s => ({ ...s, distrito: e.target.value || null }))} disabled={!selected.regional}>
                    <option value="">Seleccione</option>
                    {distritos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text)] mb-2">Sucursal *</label>
                  <select className="chk-input" value={selected.sucursal || ''} onChange={e => setSelected(s => ({ ...s, sucursal: e.target.value || null }))} disabled={!selected.distrito}>
                    <option value="">Seleccione</option>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text)] mb-2">Gerente</label>
                  <input type="text" className="chk-input" placeholder="Nombre del gerente" value={gerente} onChange={e => setGerente(e.target.value)} />
                </div>
              </div>
              <div>
                <h4 className="chk-section-title font-semibold mb-3">Evidencia fotográfica de la sucursal</h4>
                {renderItem(FOTO_SUCURSAL_ITEM)}
              </div>
              <p className="text-sm text-[var(--text-muted)]">Evaluador: <strong>Ulises Sanchez</strong></p>
              <p className="text-sm text-[var(--text-muted)]">Fecha: <strong>{new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong></p>
            </div>
          )}

          {section === 'prework' && (
            <div className="chk-card card-audit space-y-6">
              <h3 className="chk-section-title font-bold flex items-center gap-2"><i className="fas fa-chart-bar" /> Pre-work: Indicadores Clave</h3>
              <p className="text-[var(--text-muted)] text-sm">Llenar antes de entrar a piso. Si los números están mal, la visita es de corrección inmediata.</p>
              {getItemsForSection('prework').length > 0 ? (
                <>
                  {getItemsForSection('prework').filter(p => p.seccion === '1. Ventas').length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-[var(--primary)]">Ventas</h4>
                      {getItemsForSection('prework').filter(p => p.seccion === '1. Ventas').map(renderItem)}
                    </div>
                  )}
                  {getItemsForSection('prework').filter(p => p.seccion !== '1. Ventas').map(renderItem)}
                </>
              ) : (
                <p className="text-[var(--text-muted)] text-sm py-4">Recarga la página para cargar las preguntas de esta sección.</p>
              )}
            </div>
          )}

          {['financiera', 'calidad', 'mantenimiento', 'rh', 'delivery', 'marketing'].map(sec => section === sec && (
            <div key={sec} className="chk-card card-audit space-y-4">
              <h3 className="chk-section-title font-bold flex items-center gap-2"><i className={`fas ${SECTIONS.find(s => s.id === sec)?.icon}`} /> {currentSectionInfo?.title}</h3>
              {getItemsForSection(sec).length > 0 ? getItemsForSection(sec).map(renderItem) : (
                <p className="text-[var(--text-muted)] text-sm py-4">Recarga la página para cargar las preguntas de esta sección.</p>
              )}
            </div>
          ))}

          {section === 'plan-accion' && (
            <div className="chk-card card-audit space-y-6">
              <h3 className="chk-section-title font-bold flex items-center gap-2"><i className="fas fa-bullseye" /> Plan de Acción Integrado</h3>
              <p className="text-[var(--text-muted)] text-sm">Acciones correctivas basadas en Datos, Costos, Arguilea, Qualtrics + Observación</p>
              <div>
                <label className="block font-semibold text-[var(--text)] mb-2">1. Financieros/Costos</label>
                <textarea className="chk-input min-h-[80px]" placeholder="Describe la acción correctiva..." value={planFinanciero} onChange={e => setPlanFinanciero(e.target.value)} />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text)] mb-2">2. Experiencia Cliente</label>
                <textarea className="chk-input min-h-[80px]" placeholder="Meta: Subir OSAT o cerrar alertas Qualtrics" value={planExperiencia} onChange={e => setPlanExperiencia(e.target.value)} />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text)] mb-2">3. Operativo/Mtto</label>
                <textarea className="chk-input min-h-[80px]" placeholder="Acciones operativas y mantenimiento" value={planOperativo} onChange={e => setPlanOperativo(e.target.value)} />
              </div>
            </div>
          )}

          {section === 'resumen' && (
            <div className="chk-card card-audit text-center py-12">
              <i className="fas fa-clipboard-check text-7xl mb-6" style={{ color: 'var(--chk-success)' }} />
              <h2 className="text-2xl font-bold text-[var(--text)] mb-3">Checklist Completado</h2>
              <p className="text-[var(--text-muted)] max-w-md mx-auto mb-6">Revise los datos y envíe la inspección. Se requiere al menos el 80% del checklist completado para enviar y descargar el PDF.</p>
              {!canSubmit && (
                <p className="text-sm font-medium mb-4" style={{ color: 'var(--warning)' }}>
                  <i className="fas fa-exclamation-triangle mr-1" /> Complete al menos el 80% del checklist para poder enviar.
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <div className="rounded-xl px-6 py-4 min-w-[160px]" style={{ background: 'var(--bg)' }}>
                  <div className="text-3xl font-bold" style={{ color: canSubmit ? 'var(--chk-blue)' : 'var(--warning)' }}>{progress}%</div>
                  <div className="text-[var(--text-muted)] text-sm">Progreso {canSubmit ? '' : '(mín. 80%)'}</div>
                </div>
                <div className="rounded-xl px-6 py-4 min-w-[160px]" style={{ background: 'var(--bg)' }}>
                  <div className="text-xl font-bold text-[var(--text)] truncate max-w-[140px] mx-auto">{suc?.nombre || '-'}</div>
                  <div className="text-[var(--text-muted)] text-sm">Sucursal</div>
                </div>
              </div>
              <button type="button" onClick={handleSubmit} disabled={saving || !selected.sucursal || !canSubmit} className="btn btn-primary px-8 py-4 text-lg disabled:opacity-50 shadow-md" style={{ background: 'linear-gradient(135deg, var(--chk-success), #059669)' }}>
                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-paper-plane'} mr-2`} />
                {saving ? 'Guardando…' : 'Enviar Checklist'}
              </button>
              <p className="mt-4 text-sm text-[var(--text-muted)] flex items-center justify-center gap-2">
                <i className="fas fa-file-pdf" /> Podrás descargar el PDF en el detalle de la visita
              </p>
            </div>
          )}

          {section !== 'resumen' && (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6 pt-6 pb-4 border-t border-[var(--border)]">
              <button type="button" onClick={handleGuardar} disabled={saving} className="btn btn-secondary order-2 sm:order-1">
                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={() => { const i = SECTIONS.findIndex(s => s.id === section); if (i < SECTIONS.length - 1) setSection(SECTIONS[i + 1].id); }} className="btn btn-primary shadow-md order-1 sm:order-2" style={{ background: 'linear-gradient(135deg, var(--chk-blue), var(--chk-blue-dark))' }}>
                Siguiente <i className="fas fa-arrow-right" />
              </button>
            </div>
          )}
        </div>

      {toast && (
        <div className={`fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 z-50 px-5 py-4 rounded-xl shadow-xl flex items-center gap-3 max-w-sm animate-scale-in ${toast.type === 'danger' ? 'border-l-4' : 'border-l-4'}`} style={{ background: 'var(--bg-elevated)', borderLeftColor: toast.type === 'danger' ? 'var(--danger)' : 'var(--success)' }}>
          <i className={`fas ${toast.type === 'danger' ? 'fa-exclamation-circle' : 'fa-check-circle'}`} style={{ color: toast.type === 'danger' ? 'var(--danger)' : 'var(--success)' }} />
          <span className="text-[var(--text)]">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
