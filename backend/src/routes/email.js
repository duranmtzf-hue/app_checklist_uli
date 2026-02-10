import { Router } from 'express';
import nodemailer from 'nodemailer';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
}

router.post('/enviar-visita/:id', async (req, res) => {
  const { id } = req.params;
  const { to, incluirPDF } = req.body;

  const visita = db.prepare(`
    SELECT v.*, u.name as usuario_nombre, u.email as usuario_email,
           s.nombre as sucursal_nombre, s.direccion as sucursal_direccion,
           d.nombre as distrito_nombre, r.nombre as regional_nombre
    FROM visitas v
    JOIN users u ON v.usuario_id = u.id
    JOIN sucursales s ON v.sucursal_id = s.id
    JOIN distritos d ON s.distrito_id = d.id
    JOIN regionales r ON d.regional_id = r.id
    WHERE v.id = ?
  `).get(id);
  if (!visita) return res.status(404).json({ error: 'Visita no encontrada' });

  const respuestas = db.prepare(`
    SELECT vr.*, cp.titulo, cp.tipo FROM visita_respuestas vr
    JOIN checklist_plantilla cp ON vr.item_id = cp.id
    WHERE vr.visita_id = ? ORDER BY cp.orden
  `).all(id);

  const siCumple = respuestas.filter(r => r.tipo === 'si_no' && r.valor_si_no === 1);
  const noCumple = respuestas.filter(r => r.tipo === 'si_no' && r.valor_si_no === 0);
  const observaciones = respuestas.filter(r => r.valor_texto || r.observaciones).map(r => ({
    titulo: r.titulo,
    texto: r.valor_texto || r.observaciones,
  }));

  const html = `
    <h2>Resumen de visita</h2>
    <p><strong>Sucursal:</strong> ${visita.sucursal_nombre}</p>
    <p><strong>Distrito:</strong> ${visita.distrito_nombre} | <strong>Regional:</strong> ${visita.regional_nombre}</p>
    <p><strong>Fecha:</strong> ${visita.fecha}</p>
    <p><strong>Evaluador:</strong> ${visita.usuario_nombre}</p>
    <hr/>
    <h3>Hallazgos</h3>
    <p><strong>✓ Cumplió (${siCumple.length}):</strong></p>
    <ul>${siCumple.map(r => `<li>${r.titulo}</li>`).join('')}</ul>
    <p><strong>✗ No cumplió (${noCumple.length}):</strong></p>
    <ul>${noCumple.map(r => `<li>${r.titulo}${r.observaciones ? ': ' + r.observaciones : ''}</li>`).join('')}</ul>
    ${observaciones.length ? `<h3>Observaciones</h3><ul>${observaciones.map(o => `<li><strong>${o.titulo}</strong>: ${o.texto}</li>`).join('')}</ul>` : ''}
    ${visita.plan_accion ? `<h3>Plan de acción</h3><p>${visita.plan_accion.replace(/\n/g, '<br/>')}</p>` : ''}
  `;

  const transport = getTransport();
  if (!transport) {
    return res.status(503).json({
      error: 'Envío de correo no configurado (SMTP). Resumen para copiar:',
      resumen: { visita: { ...visita }, siCumple: siCumple.length, noCumple: noCumple.length, plan_accion: visita.plan_accion },
      html,
    });
  }

  const RECIPIENT_FIJO = 'hernando.sanchez@corporativoges.mx';
  const destinos = [RECIPIENT_FIJO];
  const toStr = Array.isArray(to) ? to : (to ? [to].filter(Boolean) : []);
  toStr.forEach(e => { if (e && !destinos.includes(e)) destinos.push(e); });

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'visitas@empresa.com',
    to: destinos.join(', '),
    subject: `Visita: ${visita.sucursal_nombre} - ${visita.fecha.slice(0, 10)}`,
    html,
    attachments: incluirPDF ? [] : undefined,
  };

  try {
    await transport.sendMail(mailOptions);
    res.json({ ok: true, message: 'Correo enviado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar correo', detail: err.message });
  }
});

export default router;
