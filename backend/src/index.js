import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';

import { db } from './db.js';
import { hashPassword } from './auth.js';
import auth from './routes/auth.js';
import admin from './routes/admin.js';
import regionales from './routes/regionales.js';
import distritos from './routes/distritos.js';
import sucursales from './routes/sucursales.js';
import checklist from './routes/checklist.js';
import visitas from './routes/visitas.js';
import reportes from './routes/reportes.js';
import email from './routes/email.js';
import { authMiddleware } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname) || '.jpg'}`),
});

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: true }));
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', auth);
app.use('/api/admin', admin);
app.use('/api/regionales', regionales);
app.use('/api/distritos', distritos);
app.use('/api/sucursales', sucursales);
app.use('/api/checklist', checklist);
app.use('/api/visitas', visitas);
app.use('/api/reportes', reportes);
app.use('/api/email', email);

app.get('/', (req, res) => res.json({ ok: true, message: 'APP Checklist API' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/upload', authMiddleware, multer({ storage: uploadStorage }).single('foto'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
  const relPath = path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/');
  res.json({ path: relPath });
});

// Usuario y datos iniciales si no existen
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
  const id = randomUUID();
  db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(id, 'admin@uli.com', hashPassword('admin123'), 'Administrador', 'admin');
  console.log('Usuario inicial creado: admin@uli.com / admin123');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API escuchando en http://0.0.0.0:${PORT}`);
});
