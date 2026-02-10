import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { db } from '../db.js';
import { authMiddleware, hashPassword } from '../auth.js';
import { randomUUID } from 'crypto';
import { generarPDFVisita } from '../pdfVisita.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname) || '.jpg'}`),
});
const upload = multer({ storage });

const MIN_PROGRESS_PERCENT = 80;

function progressFromRespuestas(respuestas, totalItems) {
  if (!totalItems) return 100;
  const completed = respuestas.filter((r) =>
    r.valor_si_no != null ||
    (r.valor_texto != null && String(r.valor_texto).trim() !== '') ||
    r.valor_numero != null ||
    r.valor_porcentaje != null ||
    (r.valor_foto_path != null && String(r.valor_foto_path).trim() !== '')
  ).length;
  return Math.round((completed / totalItems) * 100);
}

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const { sucursal_id, usuario_id, desde, hasta, regional_id } = req.query;
    let sql = `
      SELECT v.*, u.name as usuario_nombre, u.email as usuario_email,
             s.nombre as sucursal_nombre, s.direccion as sucursal_direccion, s.formato,
             d.nombre as distrito_nombre, r.nombre as regional_nombre
      FROM visitas v
      JOIN users u ON v.usuario_id = u.id
      JOIN sucursales s ON v.sucursal_id = s.id
      JOIN distritos d ON s.distrito_id = d.id
      JOIN regionales r ON d.regional_id = r.id
      WHERE 1=1
    `;
    const params = [];
    if (sucursal_id) { sql += ' AND v.sucursal_id = ?'; params.push(sucursal_id); }
    if (usuario_id) { sql += ' AND v.usuario_id = ?'; params.push(usuario_id); }
    if (desde) { sql += ' AND date(v.fecha) >= date(?)'; params.push(desde); }
    if (hasta) { sql += ' AND date(v.fecha) <= date(?)'; params.push(hasta); }
    if (regional_id) { sql += ' AND r.id = ?'; params.push(regional_id); }
    sql += ' ORDER BY v.fecha DESC';
    const rows = params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    console.error('GET /visitas:', err);
    res.status(500).json({ error: err.message || 'Error al cargar visitas' });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const v = db.prepare(`
      SELECT v.*, u.name as usuario_nombre, u.email as usuario_email,
             s.nombre as sucursal_nombre, s.direccion as sucursal_direccion, s.formato,
             d.nombre as distrito_nombre, r.nombre as regional_nombre
      FROM visitas v
      JOIN users u ON v.usuario_id = u.id
      JOIN sucursales s ON v.sucursal_id = s.id
      JOIN distritos d ON s.distrito_id = d.id
      JOIN regionales r ON d.regional_id = r.id
      WHERE v.id = ?
    `).get(req.params.id);
    if (!v) return res.status(404).json({ error: 'Visita no encontrada' });
    const respuestas = db.prepare(`
      SELECT vr.*, cp.titulo, cp.tipo, cp.orden, cp.seccion FROM visita_respuestas vr
      JOIN checklist_plantilla cp ON vr.item_id = cp.id
      WHERE vr.visita_id = ? ORDER BY cp.orden
    `).all(req.params.id);
    const totalItems = db.prepare('SELECT COUNT(*) as c FROM checklist_plantilla').get().c;
    const progress = progressFromRespuestas(respuestas, totalItems);
    if (progress < MIN_PROGRESS_PERCENT) {
      return res.status(400).json({ error: 'Se requiere al menos 80% del checklist completado para descargar el PDF.' });
    }
    const pdfBytes = await generarPDFVisita({ ...v, respuestas });
    const safeName = (v.sucursal_nombre || 'sucursal').replace(/[^\w\s\-]/g, '').replace(/\s+/g, '_').slice(0, 60);
    const filename = `Visita_${safeName}_${(v.fecha || '').slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Error al generar PDF:', err);
    res.status(500).json({ error: err.message || 'Error al generar PDF' });
  }
});

router.get('/:id', (req, res) => {
  const v = db.prepare(`
    SELECT v.*, u.name as usuario_nombre, u.email as usuario_email,
           s.nombre as sucursal_nombre, s.direccion as sucursal_direccion, s.formato,
           d.nombre as distrito_nombre, r.nombre as regional_nombre
    FROM visitas v
    JOIN users u ON v.usuario_id = u.id
    JOIN sucursales s ON v.sucursal_id = s.id
    JOIN distritos d ON s.distrito_id = d.id
    JOIN regionales r ON d.regional_id = r.id
    WHERE v.id = ?
  `).get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Visita no encontrada' });
  const respuestas = db.prepare(`
    SELECT vr.*, cp.titulo, cp.tipo, cp.orden, cp.seccion FROM visita_respuestas vr
    JOIN checklist_plantilla cp ON vr.item_id = cp.id
    WHERE vr.visita_id = ? ORDER BY cp.orden
  `).all(req.params.id);
  const totalItems = db.prepare('SELECT COUNT(*) as c FROM checklist_plantilla').get().c;
  const progress_percent = progressFromRespuestas(respuestas, totalItems);
  res.json({ ...v, respuestas, progress_percent });
});

router.post('/', (req, res) => {
  try {
    const { sucursal_id, fecha, plan_accion, gerente, plan_financiero, plan_experiencia, plan_operativo, respuestas, estado } = req.body;
    if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id requerido' });
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Sesión inválida. Cierre sesión y vuelva a entrar.' });
    let userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!userExists) {
      const role = (req.user?.role && ['evaluador','gerente','regional','admin'].includes(req.user.role)) ? req.user.role : 'evaluador';
      const placeholderEmail = `sync-${String(userId).replace(/-/g, '')}@app.local`;
      try {
        db.prepare(
          'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
        ).run(userId, placeholderEmail, hashPassword(randomUUID()), 'Usuario', role);
      } catch (e) {
        if (!e.message?.includes('UNIQUE')) throw e;
      }
      userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
      if (!userExists) return res.status(400).json({ error: 'No se pudo registrar la sesión. Intente de nuevo.' });
    }
    const sucExists = db.prepare('SELECT id FROM sucursales WHERE id = ?').get(sucursal_id);
    if (!sucExists) return res.status(400).json({ error: 'Sucursal no válida. Seleccione otra sucursal o recargue la página.' });
    const id = randomUUID();
    const fechaVal = fecha || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const estadoVal = ['borrador', 'completada', 'sincronizada'].includes(estado) ? estado : 'completada';
    if (estadoVal === 'completada' && Array.isArray(respuestas)) {
      const totalItems = db.prepare('SELECT COUNT(*) as c FROM checklist_plantilla').get().c;
      const progress = progressFromRespuestas(respuestas, totalItems);
      if (progress < MIN_PROGRESS_PERCENT) {
        return res.status(400).json({ error: 'Se requiere al menos 80% del checklist completado para enviar.' });
      }
    }
    db.prepare(`
      INSERT INTO visitas (id, usuario_id, sucursal_id, fecha, estado, plan_accion, gerente, plan_financiero, plan_experiencia, plan_operativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, sucursal_id, fechaVal, estadoVal, plan_accion || null, gerente || null, plan_financiero || null, plan_experiencia || null, plan_operativo || null);

    if (Array.isArray(respuestas)) {
      const validIds = new Set(db.prepare('SELECT id FROM checklist_plantilla').all().map((row) => row.id));
      const insert = db.prepare(`
        INSERT INTO visita_respuestas (id, visita_id, item_id, valor_si_no, valor_texto, valor_numero, valor_porcentaje, valor_foto_path, observaciones)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of respuestas) {
        if (!r.item_id || !validIds.has(r.item_id)) continue;
        const rid = randomUUID();
        insert.run(
          rid, id, r.item_id,
          r.valor_si_no ?? null, r.valor_texto ?? null, r.valor_numero ?? null, r.valor_porcentaje ?? null,
          r.valor_foto_path ?? null, r.observaciones ?? null
        );
      }
    }
    const visita = db.prepare(`
      SELECT v.*, s.nombre as sucursal_nombre, d.nombre as distrito_nombre, r.nombre as regional_nombre
      FROM visitas v JOIN sucursales s ON v.sucursal_id = s.id
      JOIN distritos d ON s.distrito_id = d.id JOIN regionales r ON d.regional_id = r.id WHERE v.id = ?
    `).get(id);
    res.status(201).json(visita);
  } catch (err) {
    console.error('POST /visitas:', err);
    const isFk = err.message && String(err.message).toLowerCase().includes('foreign key');
    if (isFk) {
      return res.status(400).json({ error: 'Datos no válidos (sucursal o usuario). Recargue la página, vuelva a elegir sucursal e intente de nuevo.' });
    }
    res.status(500).json({ error: err.message || 'Error al crear visita' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { plan_accion, gerente, plan_financiero, plan_experiencia, plan_operativo, estado, respuestas, sucursal_id, fecha } = req.body;
    const v = db.prepare('SELECT id FROM visitas WHERE id = ?').get(req.params.id);
    if (!v) return res.status(404).json({ error: 'Visita no encontrada' });
    if (estado === 'completada' && Array.isArray(respuestas)) {
      const totalItems = db.prepare('SELECT COUNT(*) as c FROM checklist_plantilla').get().c;
      const progress = progressFromRespuestas(respuestas, totalItems);
      if (progress < MIN_PROGRESS_PERCENT) {
        return res.status(400).json({ error: 'Se requiere al menos 80% del checklist completado para enviar.' });
      }
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (sucursal_id) {
      const sucExists = db.prepare('SELECT id FROM sucursales WHERE id = ?').get(sucursal_id);
      if (!sucExists) return res.status(400).json({ error: 'Sucursal no válida. Seleccione otra sucursal o recargue la página.' });
      db.prepare('UPDATE visitas SET sucursal_id = ?, updated_at = ? WHERE id = ?').run(sucursal_id, now, req.params.id);
    }
    if (fecha) db.prepare('UPDATE visitas SET fecha = ?, updated_at = ? WHERE id = ?').run(fecha, now, req.params.id);
    if (plan_accion !== undefined) {
      db.prepare('UPDATE visitas SET plan_accion = ?, updated_at = ? WHERE id = ?').run(plan_accion, now, req.params.id);
    }
    if (gerente !== undefined) db.prepare('UPDATE visitas SET gerente = ?, updated_at = ? WHERE id = ?').run(gerente, now, req.params.id);
    if (plan_financiero !== undefined) db.prepare('UPDATE visitas SET plan_financiero = ?, updated_at = ? WHERE id = ?').run(plan_financiero, now, req.params.id);
    if (plan_experiencia !== undefined) db.prepare('UPDATE visitas SET plan_experiencia = ?, updated_at = ? WHERE id = ?').run(plan_experiencia, now, req.params.id);
    if (plan_operativo !== undefined) db.prepare('UPDATE visitas SET plan_operativo = ?, updated_at = ? WHERE id = ?').run(plan_operativo, now, req.params.id);
    if (estado) {
      db.prepare('UPDATE visitas SET estado = ?, updated_at = ? WHERE id = ?').run(estado, now, req.params.id);
    }
    if (Array.isArray(respuestas)) {
      db.prepare('DELETE FROM visita_respuestas WHERE visita_id = ?').run(req.params.id);
      const validIds = new Set(db.prepare('SELECT id FROM checklist_plantilla').all().map((row) => row.id));
      const insert = db.prepare(`
        INSERT INTO visita_respuestas (id, visita_id, item_id, valor_si_no, valor_texto, valor_numero, valor_porcentaje, valor_foto_path, observaciones)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of respuestas) {
        if (!r.item_id || !validIds.has(r.item_id)) continue;
        insert.run(
          randomUUID(), req.params.id, r.item_id,
          r.valor_si_no ?? null, r.valor_texto ?? null, r.valor_numero ?? null, r.valor_porcentaje ?? null,
          r.valor_foto_path ?? null, r.observaciones ?? null
        );
      }
    }
    const updated = db.prepare(`
      SELECT v.*, s.nombre as sucursal_nombre, d.nombre as distrito_nombre, r.nombre as regional_nombre
      FROM visitas v JOIN sucursales s ON v.sucursal_id = s.id
      JOIN distritos d ON s.distrito_id = d.id JOIN regionales r ON d.regional_id = r.id WHERE v.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('PUT /visitas:', err);
    const isFk = err.message && String(err.message).toLowerCase().includes('foreign key');
    if (isFk) {
      return res.status(400).json({ error: 'Datos no válidos (sucursal o checklist). Recargue la página e intente de nuevo.' });
    }
    res.status(500).json({ error: err.message || 'Error al actualizar visita' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const v = db.prepare('SELECT id FROM visitas WHERE id = ?').get(req.params.id);
    if (!v) return res.status(404).json({ error: 'Visita no encontrada' });
    db.prepare('DELETE FROM visita_respuestas WHERE visita_id = ?').run(req.params.id);
    db.prepare('DELETE FROM visitas WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /visitas:', err);
    res.status(500).json({ error: err.message || 'Error al eliminar visita' });
  }
});

router.post('/:id/foto', upload.single('foto'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
  const relPath = path.relative(path.join(__dirname, '../..'), req.file.path).replace(/\\/g, '/');
  res.json({ path: relPath, filename: req.file.filename });
});

export default router;
