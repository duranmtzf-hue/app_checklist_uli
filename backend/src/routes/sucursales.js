import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware, roleMiddleware } from '../auth.js';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const { distrito_id, regional_id } = req.query;
    let sql = `
      SELECT s.*, d.nombre as distrito_nombre, d.regional_id, r.nombre as regional_nombre
      FROM sucursales s
      JOIN distritos d ON s.distrito_id = d.id
      JOIN regionales r ON d.regional_id = r.id
    `;
    const params = [];
    if (distrito_id) {
      sql += ' WHERE s.distrito_id = ?';
      params.push(distrito_id);
    } else if (regional_id) {
      sql += ' WHERE d.regional_id = ?';
      params.push(regional_id);
    }
    sql += ' ORDER BY r.nombre, d.nombre, s.nombre';
    const rows = params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    console.error('GET /sucursales:', err);
    res.status(500).json({ error: err.message || 'Error al cargar sucursales' });
  }
});

router.post('/', roleMiddleware('admin', 'regional', 'gerente'), (req, res) => {
  const { distrito_id, nombre, direccion, formato } = req.body;
  if (!distrito_id || !nombre) return res.status(400).json({ error: 'distrito_id y nombre requeridos' });
  const id = randomUUID();
  const fmt = ['free_standing', 'food_court', 'in_line'].includes(formato) ? formato : null;
  db.prepare('INSERT INTO sucursales (id, distrito_id, nombre, direccion, formato) VALUES (?, ?, ?, ?, ?)').run(id, distrito_id, nombre, direccion || null, fmt);
  const row = db.prepare(`
    SELECT s.*, d.nombre as distrito_nombre, r.nombre as regional_nombre FROM sucursales s
    JOIN distritos d ON s.distrito_id = d.id JOIN regionales r ON d.regional_id = r.id WHERE s.id = ?
  `).get(id);
  res.status(201).json(row);
});

router.put('/:id', roleMiddleware('admin', 'regional', 'gerente'), (req, res) => {
  const { nombre, direccion, distrito_id, formato } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
  db.prepare('UPDATE sucursales SET nombre = ?, direccion = COALESCE(?, direccion) WHERE id = ?').run(nombre, direccion ?? null, req.params.id);
  if (formato !== undefined) {
    const fmt = ['free_standing', 'food_court', 'in_line'].includes(formato) ? formato : null;
    db.prepare('UPDATE sucursales SET formato = ? WHERE id = ?').run(fmt, req.params.id);
  }
  if (distrito_id) db.prepare('UPDATE sucursales SET distrito_id = ? WHERE id = ?').run(distrito_id, req.params.id);
  res.json(db.prepare(`
    SELECT s.*, d.nombre as distrito_nombre, r.nombre as regional_nombre FROM sucursales s
    JOIN distritos d ON s.distrito_id = d.id JOIN regionales r ON d.regional_id = r.id WHERE s.id = ?
  `).get(req.params.id));
});

router.delete('/:id', roleMiddleware('admin', 'regional'), (req, res) => {
  try {
    const id = req.params.id;
    db.prepare('DELETE FROM visita_respuestas WHERE visita_id IN (SELECT id FROM visitas WHERE sucursal_id = ?)').run(id);
    db.prepare('DELETE FROM visitas WHERE sucursal_id = ?').run(id);
    db.prepare('DELETE FROM sucursales WHERE id = ?').run(id);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /sucursales:', err);
    res.status(500).json({ error: err.message || 'Error al eliminar sucursal' });
  }
});

export default router;
