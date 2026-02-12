import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../auth.js';
import { reseedEstructuraForce } from '../db.js';

const router = Router();
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

router.post('/reseed-estructura', (req, res) => {
  try {
    reseedEstructuraForce();
    res.json({ ok: true, message: 'Estructura restaurada correctamente' });
  } catch (err) {
    console.error('POST /admin/reseed-estructura:', err);
    res.status(500).json({ error: err.message || 'Error al restaurar estructura' });
  }
});

export default router;
