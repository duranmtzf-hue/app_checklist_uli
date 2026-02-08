import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware, roleMiddleware } from '../auth.js';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authMiddleware);

router.get('/plantilla', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM checklist_plantilla ORDER BY orden').all();
    res.json(rows);
  } catch (err) {
    console.error('GET /checklist/plantilla:', err);
    res.status(500).json({ error: err.message || 'Error al cargar plantilla' });
  }
});

router.post('/plantilla', roleMiddleware('admin'), (req, res) => {
  const { titulo, tipo, orden, obligatorio, seccion } = req.body;
  if (!titulo || !tipo) return res.status(400).json({ error: 'titulo y tipo requeridos' });
  const id = randomUUID();
  const ord = orden ?? 0;
  const ob = obligatorio !== undefined ? (obligatorio ? 1 : 0) : 1;
  db.prepare('INSERT INTO checklist_plantilla (id, titulo, tipo, orden, obligatorio, seccion) VALUES (?, ?, ?, ?, ?, ?)').run(id, titulo, tipo, ord, ob, seccion || null);
  res.status(201).json(db.prepare('SELECT * FROM checklist_plantilla WHERE id = ?').get(id));
});

router.put('/plantilla/:id', roleMiddleware('admin'), (req, res) => {
  const { titulo, tipo, orden, obligatorio, seccion } = req.body;
  db.prepare(`
    UPDATE checklist_plantilla SET
      titulo = COALESCE(?, titulo),
      tipo = COALESCE(?, tipo),
      orden = COALESCE(?, orden),
      obligatorio = COALESCE(?, obligatorio),
      seccion = COALESCE(?, seccion)
    WHERE id = ?
  `).run(titulo ?? null, tipo ?? null, orden ?? null, obligatorio !== undefined ? (obligatorio ? 1 : 0) : null, seccion !== undefined ? seccion : null, req.params.id);
  res.json(db.prepare('SELECT * FROM checklist_plantilla WHERE id = ?').get(req.params.id));
});

router.delete('/plantilla/:id', roleMiddleware('admin'), (req, res) => {
  db.prepare('DELETE FROM checklist_plantilla WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
