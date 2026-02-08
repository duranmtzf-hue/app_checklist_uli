import { Router } from 'express';
import { db } from '../db.js';
import { hashPassword, comparePassword, signToken } from '../auth.js';
import { randomUUID } from 'crypto';

const router = Router();

router.post('/register', (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Faltan email, password, name o role' });
  }
  const allowed = ['evaluador', 'gerente', 'regional', 'admin'];
  if (!allowed.includes(role)) {
    return res.status(400).json({ error: 'Rol no válido' });
  }
  const id = randomUUID();
  const password_hash = hashPassword(password);
  try {
    db.prepare(
      'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
    ).run(id, email, password_hash, name, role);
    const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(id);
    res.status(201).json({ user, token: signToken({ id: user.id, role: user.role }) });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }
    throw e;
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }
  const user = db.prepare(
    'SELECT id, email, name, role, password_hash FROM users WHERE email = ?'
  ).get(email);
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const { password_hash, ...safe } = user;
  res.json({ user: safe, token: signToken({ id: safe.id, role: safe.role }) });
});

export default router;
