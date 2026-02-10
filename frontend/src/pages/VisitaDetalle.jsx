import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { visitas as apiVisitas, email as apiEmail } from '../api';
import { listarVisitasOffline } from '../store';

export default function VisitaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [visita, setVisita] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailTo, setEmailTo] = useState('hernando.sanchez@corporativoges.mx');
  const [sending, setSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [pdfMsg, setPdfMsg] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (id.startsWith('offline-')) {
      listarVisitasOffline().then((list) => {
        const v = list.find((x) => x.id === id);
        setVisita(v ? { ...v, _offline: true } : null);
      }).catch(() => setVisita(null)).finally(() => setLoading(false));
    } else {
      apiVisitas.get(id).then(setVisita).catch(() => setVisita(null)).finally(() => setLoading(false));
    }
  }, [id]);

  const handleDescargarPDF = async () => {
    if (!id || id.startsWith('offline-')) return;
    setDownloadingPDF(true);
    setPdfMsg('');
    try {
      const fn = `Visita_${(visita?.sucursal_nombre || 'sucursal').replace(/\s+/g, '_')}_${(visita?.fecha || '').slice(0, 10)}.pdf`;
      await apiVisitas.downloadPDF(id, fn);
      setPdfMsg('PDF descargado correctamente');
      setTimeout(() => setPdfMsg(''), 3000);
    } catch (err) {
      setPdfMsg(err.message || 'Error al descargar PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleBorrar = async () => {
    if (!id || id.startsWith('offline-')) return;
    if (!window.confirm('¿Eliminar esta visita? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    try {
      await apiVisitas.delete(id);
      navigate('/historial');
    } catch (err) {
      setEmailMsg(err.message || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const handleEnviarCorreo = async (e) => {
    e.preventDefault();
    setSending(true);
    setEmailMsg('');
    try {
      await apiEmail.enviarVisita(id, { to: emailTo, incluirPDF: false });
      setEmailMsg('Correo enviado correctamente.');
    } catch (err) {
      setEmailMsg(err.message || 'Error al enviar');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-10 h-10 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
        <p className="text-[var(--text-muted)] mt-4">Cargando…</p>
      </div>
    );
  }
  if (!visita) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--text-muted)]">Visita no encontrada.</p>
        <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary mt-4"><i className="fas fa-arrow-left" /> Volver</button>
      </div>
    );
  }

  const respuestas = visita.respuestas || [];
  const progressPercent = visita.progress_percent ?? 100;
  const canDownloadPDF = progressPercent >= 80;
  const siCumple = respuestas.filter(r => r.tipo === 'si_no' && r.valor_si_no === 1);
  const noCumple = respuestas.filter(r => r.tipo === 'si_no' && r.valor_si_no === 0);

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      <button type="button" onClick={() => navigate(-1)} className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-[var(--bg-elevated)] text-[var(--text)] touch-manipulation">
        <i className="fas fa-arrow-left" />
      </button>

      <div>
        <h1 className="text-2xl font-extrabold text-[var(--text)]">Visita: {visita.sucursal_nombre}</h1>
        <p className="text-[var(--text-muted)] text-sm mt-0.5">{visita.regional_nombre} → {visita.distrito_nombre}</p>
      </div>

      <div className="card-audit space-y-2">
        <p className="flex justify-between"><span className="text-[var(--text-muted)]">Fecha</span><span className="font-semibold text-[var(--text)]">{visita.fecha}</span></p>
        <p className="flex justify-between"><span className="text-[var(--text-muted)]">Gerente</span><span className="font-semibold text-[var(--text)]">{visita.gerente || '-'}</span></p>
        <p className="flex justify-between"><span className="text-[var(--text-muted)]">Evaluador</span><span className="font-semibold text-[var(--text)]">{visita.usuario_nombre || 'Ulises Sanchez'}</span></p>
      </div>

      <div className="flex flex-col gap-2">
        {!canDownloadPDF && (
          <p className="text-sm font-medium" style={{ color: 'var(--warning)' }}>
            <i className="fas fa-exclamation-triangle mr-1" /> Se requiere al menos 80% del checklist completado para descargar el PDF ({progressPercent}%).
          </p>
        )}
        <button
          type="button"
          onClick={handleDescargarPDF}
          disabled={downloadingPDF || id?.startsWith('offline-') || !canDownloadPDF}
          className="btn btn-primary flex-1"
        >
          <i className={`fas ${downloadingPDF ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} />
          {downloadingPDF ? 'Generando…' : 'Descargar PDF'}
        </button>
        {pdfMsg && (
          <p className={`text-sm font-medium ${pdfMsg.includes('Error') ? '' : ''}`} style={{ color: pdfMsg.includes('Error') ? 'var(--danger)' : 'var(--success)' }}>
            {pdfMsg}
          </p>
        )}
      </div>

      <section>
        <h2 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--success)' }}>
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: 'rgba(74,222,128,0.2)', color: 'var(--success)' }}><i className="fas fa-check" /></span>
          Cumplió ({siCumple.length})
        </h2>
        <ul className="space-y-1.5">
          {siCumple.map(r => (
            <li key={r.id} className="card-audit py-2.5 px-3 text-[var(--text)] text-sm flex items-center gap-2">
              <span style={{ color: 'var(--success)' }}>•</span> {r.titulo}
            </li>
          ))}
          {siCumple.length === 0 && <li className="text-[var(--text-muted)] text-sm">Ninguno</li>}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--warning)' }}>
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--warning)' }}><i className="fas fa-times" /></span>
          No cumplió ({noCumple.length})
        </h2>
        <ul className="space-y-1.5">
          {noCumple.map(r => (
            <li key={r.id} className="card-audit py-2.5 px-3 text-[var(--text)] text-sm">
              {r.titulo}{r.observaciones ? <span className="text-[var(--text-muted)] block mt-0.5">— {r.observaciones}</span> : ''}
            </li>
          ))}
          {noCumple.length === 0 && <li className="text-[var(--text-muted)] text-sm">Ninguno</li>}
        </ul>
      </section>

      {respuestas.filter(r => r.tipo !== 'si_no' && (r.valor_texto || r.valor_numero != null || r.valor_porcentaje != null || r.valor_foto_path)).length > 0 && (
        <section>
          <h2 className="font-semibold text-[var(--text)] mb-2">Datos y observaciones</h2>
          <div className="card-audit space-y-3">
            {respuestas.map(r => {
              if (r.tipo === 'si_no') return null;
              let val = r.valor_texto ?? (r.valor_porcentaje != null ? r.valor_porcentaje + '%' : null);
              if (r.tipo === 'estatus' && r.valor_numero != null) {
                val = r.valor_numero === 1 ? '🟢' : r.valor_numero === 2 ? '🟡' : r.valor_numero === 3 ? '🔴' : r.valor_numero;
              } else if (val == null && r.valor_numero != null) val = r.valor_numero;
              if (r.tipo === 'foto' && r.valor_foto_path) val = 'Foto adjunta';
              if (val == null && !r.valor_foto_path) return null;
              return (
                <p key={r.id} className="flex justify-between items-start gap-4">
                  <span className="text-[var(--text-muted)] text-sm">{r.titulo}</span>
                  <span className="font-semibold text-[var(--text)] text-right">{val}</span>
                </p>
              );
            })}
          </div>
        </section>
      )}

      {(visita.plan_financiero || visita.plan_experiencia || visita.plan_operativo || visita.plan_accion) && (
        <section>
          <h2 className="font-semibold text-[var(--text)] mb-2">Plan de acción integrado</h2>
          <div className="card-audit space-y-4">
            {visita.plan_financiero && (
              <div>
                <h3 className="font-medium text-[var(--primary)] text-sm mb-1">1. Financieros / Costos</h3>
                <p className="whitespace-pre-wrap text-[var(--text-muted)] text-sm leading-relaxed">{visita.plan_financiero}</p>
              </div>
            )}
            {visita.plan_experiencia && (
              <div>
                <h3 className="font-medium text-[var(--primary)] text-sm mb-1">2. Experiencia cliente</h3>
                <p className="whitespace-pre-wrap text-[var(--text-muted)] text-sm leading-relaxed">{visita.plan_experiencia}</p>
              </div>
            )}
            {visita.plan_operativo && (
              <div>
                <h3 className="font-medium text-[var(--primary)] text-sm mb-1">3. Operativo / Mtto</h3>
                <p className="whitespace-pre-wrap text-[var(--text-muted)] text-sm leading-relaxed">{visita.plan_operativo}</p>
              </div>
            )}
            {visita.plan_accion && (
              <div>
                <h3 className="font-medium text-[var(--primary)] text-sm mb-1">Comentarios adicionales</h3>
                <p className="whitespace-pre-wrap text-[var(--text-muted)] text-sm leading-relaxed">{visita.plan_accion}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {visita._offline && (
        <div className="card-audit p-3 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'var(--warning)' }}>
          <i className="fas fa-wifi-slash text-[var(--warning)]" />
          <span className="text-sm font-medium">Visita guardada offline. Se sincronizará automáticamente cuando haya conexión.</span>
        </div>
      )}

      {!id?.startsWith('offline-') && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleBorrar}
            disabled={deleting}
            className="btn btn-secondary"
            style={{ color: 'var(--danger)' }}
          >
            <i className={`fas ${deleting ? 'fa-spinner fa-spin' : 'fa-trash-alt'}`} />
            {deleting ? 'Eliminando…' : 'Eliminar visita'}
          </button>
        </div>
      )}

      {!visita._offline && (
      <section className="card-audit">
        <h2 className="font-semibold text-[var(--text)] mb-3">Enviar por correo</h2>
        <form onSubmit={handleEnviarCorreo} className="flex flex-col sm:flex-row gap-2">
          <input type="email" placeholder="Correo destino" className="input-audit flex-1" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
          <button type="submit" className="btn btn-primary shrink-0" disabled={sending}>
            <i className="fas fa-paper-plane" /> {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
        {emailMsg && <p className={`mt-2 text-sm font-medium ${emailMsg.includes('Error') ? '' : ''}`} style={{ color: emailMsg.includes('Error') ? 'var(--warning)' : 'var(--success)' }}>{emailMsg}</p>}
      </section>
      )}
    </div>
  );
}
