import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware, roleMiddleware } from '../auth.js';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM regionales ORDER BY nombre').all();
    res.json(rows);
  } catch (err) {
    console.error('GET /regionales:', err);
    res.status(500).json({ error: err.message || 'Error al cargar regionales' });
  }
});

router.post('/', roleMiddleware('admin', 'regional'), (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
  const id = randomUUID();
  db.prepare('INSERT INTO regionales (id, nombre) VALUES (?, ?)').run(id, nombre);
  res.status(201).json(db.prepare('SELECT * FROM regionales WHERE id = ?').get(id));
});

router.put('/:id', roleMiddleware('admin', 'regional'), (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
  db.prepare('UPDATE regionales SET nombre = ? WHERE id = ?').run(nombre, req.params.id);
  res.json(db.prepare('SELECT * FROM regionales WHERE id = ?').get(req.params.id));
});

router.delete('/:id', roleMiddleware('admin', 'regional'), (req, res) => {
  try {
    const id = req.params.id;
    const distritosIds = db.prepare('SELECT id FROM distritos WHERE regional_id = ?').all(id).map(d => d.id);
    if (distritosIds.length) {
      for (const did of distritosIds) {
        const sucIds = db.prepare('SELECT id FROM sucursales WHERE distrito_id = ?').all(did).map(s => s.id);
        for (const sid of sucIds) {
          db.prepare('DELETE FROM visita_respuestas WHERE visita_id IN (SELECT id FROM visitas WHERE sucursal_id = ?)').run(sid);
          db.prepare('DELETE FROM visitas WHERE sucursal_id = ?').run(sid);
        }
        db.prepare('DELETE FROM sucursales WHERE distrito_id = ?').run(did);
      }
      db.prepare('DELETE FROM distritos WHERE regional_id = ?').run(id);
    }
    db.prepare('DELETE FROM regionales WHERE id = ?').run(id);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /regionales:', err);
    res.status(500).json({ error: err.message || 'Error al eliminar regional' });
  }
});

export default router;
