import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware, roleMiddleware } from '../auth.js';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const { regional_id } = req.query;
    let sql = 'SELECT d.*, r.nombre as regional_nombre FROM distritos d JOIN regionales r ON d.regional_id = r.id';
    const params = [];
    if (regional_id) {
      sql += ' WHERE d.regional_id = ?';
      params.push(regional_id);
    }
    sql += ' ORDER BY d.nombre';
    const rows = params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    console.error('GET /distritos:', err);
    res.status(500).json({ error: err.message || 'Error al cargar distritos' });
  }
});

router.post('/', roleMiddleware('admin', 'regional'), (req, res) => {
  const { regional_id, nombre } = req.body;
  if (!regional_id || !nombre) return res.status(400).json({ error: 'regional_id y nombre requeridos' });
  const id = randomUUID();
  db.prepare('INSERT INTO distritos (id, regional_id, nombre) VALUES (?, ?, ?)').run(id, regional_id, nombre);
  res.status(201).json(db.prepare('SELECT d.*, r.nombre as regional_nombre FROM distritos d JOIN regionales r ON d.regional_id = r.id WHERE d.id = ?').get(id));
});

router.put('/:id', roleMiddleware('admin', 'regional'), (req, res) => {
  const { nombre, regional_id } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
  if (regional_id) {
    db.prepare('UPDATE distritos SET nombre = ?, regional_id = ? WHERE id = ?').run(nombre, regional_id, req.params.id);
  } else {
    db.prepare('UPDATE distritos SET nombre = ? WHERE id = ?').run(nombre, req.params.id);
  }
  res.json(db.prepare('SELECT d.*, r.nombre as regional_nombre FROM distritos d JOIN regionales r ON d.regional_id = r.id WHERE d.id = ?').get(req.params.id));
});

router.delete('/:id', roleMiddleware('admin', 'regional'), (req, res) => {
  try {
    const id = req.params.id;
    const sucIds = db.prepare('SELECT id FROM sucursales WHERE distrito_id = ?').all(id).map(s => s.id);
    for (const sid of sucIds) {
      db.prepare('DELETE FROM visita_respuestas WHERE visita_id IN (SELECT id FROM visitas WHERE sucursal_id = ?)').run(sid);
      db.prepare('DELETE FROM visitas WHERE sucursal_id = ?').run(sid);
    }
    db.prepare('DELETE FROM sucursales WHERE distrito_id = ?').run(id);
    db.prepare('DELETE FROM distritos WHERE id = ?').run(id);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /distritos:', err);
    res.status(500).json({ error: err.message || 'Error al eliminar distrito' });
  }
});

export default router;
