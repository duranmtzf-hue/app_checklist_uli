import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

// Resumen por sucursal
router.get('/sucursal/:id', (req, res) => {
  const { id } = req.params;
  const visitas = db.prepare(`
    SELECT v.*, u.name as usuario_nombre FROM visitas v
    JOIN users u ON v.usuario_id = u.id
    WHERE v.sucursal_id = ? ORDER BY v.fecha DESC
  `).all(id);
  const sucursal = db.prepare(`
    SELECT s.*, d.nombre as distrito_nombre, r.nombre as regional_nombre
    FROM sucursales s JOIN distritos d ON s.distrito_id = d.id JOIN regionales r ON d.regional_id = r.id
    WHERE s.id = ?
  `).get(id);
  if (!sucursal) return res.status(404).json({ error: 'Sucursal no encontrada' });
  res.json({ sucursal, visitas });
});

// Resumen por distrito
router.get('/distrito/:id', (req, res) => {
  const { id } = req.params;
  const distrito = db.prepare(`
    SELECT d.*, r.nombre as regional_nombre FROM distritos d JOIN regionales r ON d.regional_id = r.id WHERE d.id = ?
  `).get(id);
  if (!distrito) return res.status(404).json({ error: 'Distrito no encontrado' });
  const visitas = db.prepare(`
    SELECT v.*, s.nombre as sucursal_nombre, u.name as usuario_nombre
    FROM visitas v JOIN sucursales s ON v.sucursal_id = s.id JOIN users u ON v.usuario_id = u.id
    WHERE s.distrito_id = ? ORDER BY v.fecha DESC
  `).all(id);
  const sucursales = db.prepare('SELECT id, nombre FROM sucursales WHERE distrito_id = ?').all(id);
  res.json({ distrito, sucursales, visitas });
});

// Resumen por regional
router.get('/regional/:id', (req, res) => {
  const { id } = req.params;
  const regional = db.prepare('SELECT * FROM regionales WHERE id = ?').get(id);
  if (!regional) return res.status(404).json({ error: 'Regional no encontrada' });
  const distritos = db.prepare('SELECT id, nombre FROM distritos WHERE regional_id = ?').all(id);
  const visitas = db.prepare(`
    SELECT v.*, s.nombre as sucursal_nombre, d.nombre as distrito_nombre, u.name as usuario_nombre
    FROM visitas v
    JOIN sucursales s ON v.sucursal_id = s.id
    JOIN distritos d ON s.distrito_id = d.id
    JOIN users u ON v.usuario_id = u.id
    WHERE d.regional_id = ? ORDER BY v.fecha DESC
  `).all(id);
  res.json({ regional, distritos, visitas });
});

// Comparación entre sucursales (lista de sucursales con conteo de visitas y cumplimiento reciente)
router.get('/comparar', (req, res) => {
  const { regional_id, distrito_id } = req.query;
  let sql = `
    SELECT s.id, s.nombre as sucursal_nombre, d.nombre as distrito_nombre, r.nombre as regional_nombre,
           COUNT(v.id) as total_visitas,
           MAX(v.fecha) as ultima_visita
    FROM sucursales s
    JOIN distritos d ON s.distrito_id = d.id
    JOIN regionales r ON d.regional_id = r.id
    LEFT JOIN visitas v ON v.sucursal_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (regional_id) { sql += ' AND r.id = ?'; params.push(regional_id); }
  if (distrito_id) { sql += ' AND d.id = ?'; params.push(distrito_id); }
  sql += ' GROUP BY s.id ORDER BY r.nombre, d.nombre, s.nombre';
  const rows = params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all();
  res.json(rows);
});

// Historial de visitas (ya cubierto por GET /visitas, pero con filtros amigables)
router.get('/historial', (req, res) => {
  const { regional_id, distrito_id, sucursal_id, desde, hasta } = req.query;
  let sql = `
    SELECT v.id, v.fecha, v.estado, u.name as usuario_nombre, s.nombre as sucursal_nombre,
           d.nombre as distrito_nombre, r.nombre as regional_nombre
    FROM visitas v
    JOIN users u ON v.usuario_id = u.id
    JOIN sucursales s ON v.sucursal_id = s.id
    JOIN distritos d ON s.distrito_id = d.id
    JOIN regionales r ON d.regional_id = r.id
    WHERE 1=1
  `;
  const params = [];
  if (regional_id) { sql += ' AND r.id = ?'; params.push(regional_id); }
  if (distrito_id) { sql += ' AND d.id = ?'; params.push(distrito_id); }
  if (sucursal_id) { sql += ' AND s.id = ?'; params.push(sucursal_id); }
  if (desde) { sql += ' AND date(v.fecha) >= date(?)'; params.push(desde); }
  if (hasta) { sql += ' AND date(v.fecha) <= date(?)'; params.push(hasta); }
  sql += ' ORDER BY v.fecha DESC';
  const rows = params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all();
  res.json(rows);
});

export default router;
