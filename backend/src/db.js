import pkg from 'node-sqlite3-wasm';
const { Database } = pkg;
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/app.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('evaluador','gerente','regional','admin')),
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS regionales (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS distritos (
    id TEXT PRIMARY KEY,
    regional_id TEXT NOT NULL REFERENCES regionales(id),
    nombre TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sucursales (
    id TEXT PRIMARY KEY,
    distrito_id TEXT NOT NULL REFERENCES distritos(id),
    nombre TEXT NOT NULL,
    direccion TEXT,
    formato TEXT CHECK(formato IN ('free_standing','food_court','in_line')),
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS checklist_plantilla (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('si_no','texto','numero','porcentaje','foto','estatus')),
    orden INTEGER NOT NULL DEFAULT 0,
    obligatorio INTEGER DEFAULT 1,
    seccion TEXT
  );
  CREATE TABLE IF NOT EXISTS visitas (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES users(id),
    sucursal_id TEXT NOT NULL REFERENCES sucursales(id),
    fecha TEXT NOT NULL,
    estado TEXT DEFAULT 'borrador' CHECK(estado IN ('borrador','completada','sincronizada')),
    plan_accion TEXT,
    gerente TEXT,
    plan_financiero TEXT,
    plan_experiencia TEXT,
    plan_operativo TEXT,
    sincronizado_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS visita_respuestas (
    id TEXT PRIMARY KEY,
    visita_id TEXT NOT NULL REFERENCES visitas(id),
    item_id TEXT NOT NULL REFERENCES checklist_plantilla(id),
    valor_si_no INTEGER,
    valor_texto TEXT,
    valor_numero REAL,
    valor_porcentaje REAL,
    valor_foto_path TEXT,
    observaciones TEXT,
    UNIQUE(visita_id, item_id)
  );
  CREATE INDEX IF NOT EXISTS idx_visitas_usuario ON visitas(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_visitas_sucursal ON visitas(sucursal_id);
  CREATE INDEX IF NOT EXISTS idx_visitas_fecha ON visitas(fecha);
  CREATE INDEX IF NOT EXISTS idx_distritos_regional ON distritos(regional_id);
  CREATE INDEX IF NOT EXISTS idx_sucursales_distrito ON sucursales(distrito_id);
`);

// Migración: agregar formato si no existe (para DBs existentes)
try {
  const cols = db.prepare("PRAGMA table_info(sucursales)").all();
  if (!cols.some(c => c.name === 'formato')) {
    db.exec('ALTER TABLE sucursales ADD COLUMN formato TEXT');
  }
} catch (_) {}

// Migración: agregar seccion a checklist_plantilla
try {
  const cols = db.prepare("PRAGMA table_info(checklist_plantilla)").all();
  if (!cols.some(c => c.name === 'seccion')) {
    db.exec('ALTER TABLE checklist_plantilla ADD COLUMN seccion TEXT');
  }
} catch (_) {}

// Migración: agregar gerente, plan_financiero, plan_experiencia, plan_operativo a visitas
['gerente', 'plan_financiero', 'plan_experiencia', 'plan_operativo'].forEach(col => {
  try {
    const cols = db.prepare("PRAGMA table_info(visitas)").all();
    if (!cols.some(c => c.name === col)) {
      db.exec(`ALTER TABLE visitas ADD COLUMN ${col} TEXT`);
    }
  } catch (_) {}
});

const CHECKLIST_INTEGRAL = [
  // ——— DATOS DE LA VISITA (Información General) ———
  ['dato-foto-sucursal', 'Evidencia fotográfica de la sucursal', 'foto', 0, 0, 'Datos de la Visita'],
  // ——— 1. PRE-WORK: INDICADORES CLAVE ———
  // VENTAS
  ['ventas-va', 'Venta Actual Acumulada', 'texto', -5, 0, '1. Ventas'],
  ['ventas-vaa', 'Venta Año Anterior Acumulado', 'texto', -4, 0, '1. Ventas'],
  ['ventas-bg', 'Brecha(Gap)', 'texto', -3, 0, '1. Ventas'],
  ['ventas-pd', 'porcentaje de diferencia', 'porcentaje', -2, 0, '1. Ventas'],
  ['ventas-c', 'cumplimiento', 'texto', -1, 0, '1. Ventas'],
  // A. SATISFACCIÓN (QUALTRICS) — Dato Actual | Meta/Objetivo | Estatus
  ['c1-1', 'OSAT (Satisfacción General): Dato actual (%)', 'porcentaje', 1, 1, '1A. Pre-work: Satisfacción (Qualtrics)'],
  ['c1-1e', 'OSAT Estatus (🟢🟡🔴)', 'estatus', 2, 0, '1A. Pre-work: Satisfacción (Qualtrics)'],
  ['c1-2', 'Speed of Service (Percepción): Dato actual (%)', 'porcentaje', 4, 0, '1A. Pre-work: Satisfacción (Qualtrics)'],
  ['c1-2e', 'Speed of Service Estatus', 'estatus', 5, 0, '1A. Pre-work: Satisfacción (Qualtrics)'],
  ['c1-3', 'Precisión: Dato actual (%)', 'porcentaje', 7, 0, '1A. Pre-work: Satisfacción (Qualtrics)'],
  ['c1-3e', 'Precisión Estatus', 'estatus', 8, 0, '1A. Pre-work: Satisfacción (Qualtrics)'],
  ['c1-4', 'Cantidad de encuestas', 'numero', 10, 0, '1A. Pre-work: Satisfacción (Qualtrics)'],
  ['c1-4e', 'Encuestas', 'estatus', 11, 0, '1A. Pre-work: Satisfacción (Qualtrics)'],
  // B. COSTOS Y CONTROL (REPORTE ARGUILEA) — Dato Actual | Desviación Permitida | Estatus
  ['c1-5', 'Resultado Global Auditoría: Dato actual (%) — Meta >95%', 'porcentaje', 13, 0, '1B. Pre-work: Costos y Control (Arguilea)'],
  ['c1-5m', 'Resultado Auditoria: Puntos perdidos (ej.>95%)', 'texto', 14, 0, '1B. Pre-work: Costos y Control (Arguilea)'],
  ['c1-5e', 'Resultado Auditoría Estatus', 'estatus', 15, 0, '1B. Pre-work: Costos y Control (Arguilea)'],
  ['c1-6', 'Días de Inventario: Dato actual — Meta 14 días', 'numero', 16, 0, '1B. Pre-work: Costos y Control (Arguilea)'],
  ['c1-6e', 'Inventario Estatus', 'estatus', 17, 0, '1B. Pre-work: Costos y Control (Arguilea)'],
  ['c1-7', 'COS (Costo de Venta) Real vs Teórico: Dato (%) — Meta +/- 0.5%', 'porcentaje', 19, 0, '1B. Pre-work: Costos y Control (Arguilea)'],
  ['c1-7m', 'COS: Desviación permitida (ej. +/- 0.5%)', 'texto', 20, 0, '1B. Pre-work: Costos y Control (Arguilea)'],
  ['c1-7e', 'COS Estatus', 'estatus', 21, 0, '1B. Pre-work: Costos y Control (Arguilea)'],
  ['c1-8', 'Top 3 Faltantes (Mermas/Robo): 1. ________  2. ________  3. ________', 'texto', 22, 0, '1B. Pre-work: Costos y Control (Arguilea)'],
  ['c1-9', 'Porcentaje de mano de obra (%)', 'porcentaje', 23, 0, '1B. Pre-work: Costos y Control (Arguilea)'],
  // ——— 2. VALIDACIÓN FINANCIERA EN CAMPO ———
  ['c2-1', 'Validación de Faltantes Críticos', 'si_no', 24, 1, '2. Validación Financiera en Campo'],
  ['c2-2', 'Registro de Mermas: ¿Se está pesando/contando la merma real o solo se digita?', 'si_no', 25, 1, '2. Validación Financiera en Campo'],
  ['c2-3', 'Verificar proceso de elaboración de productos', 'si_no', 26, 1, '2. Validación Financiera en Campo'],
  ['c2-4', 'Todos los productos químicos están bajo llave y almacenes cerrados', 'si_no', 27, 1, '2. Validación Financiera en Campo'],
  ['c2-5', 'Envío de liquidaciones', 'texto', 28, 0, '2. Validación Financiera en Campo'],
  // ——— 3. CALIDAD Y EXPERIENCIA (Causa Raíz Qualtrics) ———
  ['c3-1', 'Temperatura del Producto: Tomar temp. de carnes y papas.', 'si_no', 29, 1, '3. Calidad y Experiencia (Qualtrics)'],
  ['c3-2', 'Temp. Carne (°F)', 'numero', 30, 0, '3. Calidad y Experiencia (Qualtrics)'],
  ['c3-3', 'Limpieza de Baños/Comedor: (Factor #1 de baja calificación en limpieza).', 'si_no', 31, 1, '3. Calidad y Experiencia (Qualtrics)'],
  ['c3-4', 'Amabilidad en Caja/Entrega: ¿Hubo contacto visual, saludo y sonrisa?', 'si_no', 32, 1, '3. Calidad y Experiencia (Qualtrics)'],
  ['c3-5', 'Exactitud de la Orden: Revisar 1 bolsa de entrega. ¿Está completa y con servilletas?', 'si_no', 33, 1, '3. Calidad y Experiencia (Qualtrics)'],
  ['c3-6', 'Errores detectados en órdenes', 'numero', 34, 0, '3. Calidad y Experiencia (Qualtrics)'],
  // ——— 4. MANTENIMIENTO E IMAGEN (Soporte a la Venta) ———
  ['c4-1', 'Equipos Críticos: ¿Funcionan al 100%? (Broiler, Freidoras, Helado y equipos de refrigeración).', 'si_no', 35, 1, '4. Mantenimiento e Imagen'],
  ['c4-2', 'Imagen Exterior: ¿Iluminación y limpieza invitan a entrar?', 'si_no', 36, 1, '4. Mantenimiento e Imagen'],
  ['c4-3', 'Wifi, A.C., música y TV: ¿Funcionan correctamente para el cliente?', 'si_no', 37, 1, '4. Mantenimiento e Imagen'],
  ['c4-4', 'Estado drive thru: funcionando tres diademas', 'si_no', 38, 1, '4. Mantenimiento e Imagen'],
  ['c4-5', 'Comedor limpio y mobiliario en buen estado', 'estatus', 39, 0, '4. Mantenimiento e Imagen'],
  // ——— 5. RECURSOS HUMANOS (Productividad) ———
  ['c5-1', 'Plantilla vs. Venta: ¿Hay personal sobrado para la venta actual? (Impacto en Labor Cost).', 'si_no', 40, 1, '5. Recursos Humanos'],
  ['c5-2', 'Uniformes y Presencia: Estándar de marca completo.', 'si_no', 41, 1, '5. Recursos Humanos'],
  // ——— 6. DELIVERY Y AGREGADORES (Uber / DiDi / Rappi) ———
  ['c6-1', 'Disponibilidad: ¿Todas las tabletas están encendidas y recibiendo pedidos?', 'si_no', 42, 1, '6. Delivery y Agregadores'],
  ['c6-1a', 'Apps apagadas (especificar)', 'texto', 43, 0, '6. Delivery y Agregadores'],
  ['c6-2', 'Auditoría de Cancelaciones: Revisar historial en tablet. ¿Hay cancelaciones manuales sospechosas hoy?', 'si_no', 44, 0, '6. Delivery y Agregadores'],
  ['c6-2a', '# Cancelaciones hoy', 'numero', 45, 0, '6. Delivery y Agregadores'],
  ['c6-3', 'Delivery y agregadores: ¿Salen con sticker de seguridad y ticket?', 'si_no', 46, 1, '6. Delivery y Agregadores'],
  ['c6-4', 'Zona de Repartidores: ¿Está separada del comedor y limpia?', 'si_no', 47, 1, '6. Delivery y Agregadores'],
  ['c6-5', 'Tiempo de Preparación: ¿El repartidor espera < 5 min?', 'si_no', 48, 0, '6. Delivery y Agregadores'],
  ['c6-5a', 'Tiempo promedio (min)', 'numero', 49, 0, '6. Delivery y Agregadores'],
  ['c6-6', 'Existencia Virtual: ¿El menú en la App coincide con la realidad? (Ej. Si no hay helado, ¿está bloqueado en la App?)', 'si_no', 50, 0, '6. Delivery y Agregadores'],
  ['c6-7', 'Número de empleados', 'numero', 51, 0, '5. Recursos Humanos'],
  ['c6-8', 'Número de gerentes', 'numero', 52, 0, '5. Recursos Humanos'],
  // ——— 7. MERCADOTECNIA E IMAGEN COMERCIAL ———
  // A. PRECIOS Y MENÚ BOARD
  ['c7-1', 'Integridad del Menú: ¿Precios legibles y actualizados? (Sin parches de cinta ni cartones pegados).', 'si_no', 53, 1, '7A. Mercadotecnia: Precios y Menú Board'],
  ['c7-2', 'Iluminación Menú: ¿Funcionan todas las luces/pantallas del Menú Board Interior y Drive Thru?', 'si_no', 54, 1, '7A. Mercadotecnia: Precios y Menú Board'],
  ['c7-2a', 'Focos fundidos (especificar)', 'texto', 55, 0, '7A. Mercadotecnia: Precios y Menú Board'],
  ['c7-3', 'Cruce de Precios: Validar 3 combos aleatorios. ¿El precio en el tablero coincide con el precio en la caja (POS)?', 'si_no', 56, 0, '7A. Mercadotecnia: Precios y Menú Board'],
  // B. MATERIAL P.O.P. (Material Punto de Venta)
  ['c7-4', 'Vigencia de Campaña: ¿Los posters, banners y transparencias corresponden a la campaña ACTUAL? (Ej. "Whopper Serrano").', 'si_no', 57, 1, '7B. Mercadotecnia: Material P.O.P.'],
  ['c7-4a', 'Material vencido detectado (especificar)', 'texto', 58, 0, '7B. Mercadotecnia: Material P.O.P.'],
  ['c7-5', 'Estado del Material: ¿Están en buen estado? (Sin esquinas despegadas, decolorados por el sol o rotos).', 'si_no', 59, 1, '7B. Mercadotecnia: Material P.O.P.'],
  ['c7-6', 'Stopper/Habladores: ¿Están colocados en las cajas registradoras comunicando la promoción del mes?', 'si_no', 60, 1, '7B. Mercadotecnia: Material P.O.P.'],
  // C. JUGUETES (KING JR / KIDS)
  ['c7-7', 'Exhibidor (Juguetes): ¿Está limpio, iluminado y lleno con los juguetes de la licencia actual?', 'si_no', 61, 0, '7C. Mercadotecnia: Juguetes (King Jr)'],
  ['c7-8', 'Disponibilidad de Licencia: ¿Hay stock suficiente de la colección vigente en almacén?', 'si_no', 62, 0, '7C. Mercadotecnia: Juguetes (King Jr)'],
  ['c7-8a', 'Licencia actual (especificar)', 'texto', 63, 0, '7C. Mercadotecnia: Juguetes (King Jr)'],
  ['c7-9', 'Comunicación Visual: ¿Hay material gráfico del juguete visible para el niño a su altura?', 'si_no', 64, 0, '7C. Mercadotecnia: Juguetes (King Jr)'],
  // D. PROMOCIONES Y CUPONES
  ['c7-10', 'Conocimiento del Staff: Preguntar al cajero: "¿Cuál es la promo de la App hoy?". ¿Sabe responder?', 'si_no', 65, 0, '7D. Mercadotecnia: Promociones y Cupones'],
  ['c7-11', 'Escaneo de Cupones: ¿El escáner de códigos QR de la App funciona correctamente?', 'si_no', 66, 0, '7D. Mercadotecnia: Promociones y Cupones'],
  ['c7-12', 'Promociones Agresivas: Si hay "2x$" o "Combo del Día", ¿está marcado en el sistema o requieren llamar al gerente?', 'si_no', 67, 0, '7D. Mercadotecnia: Promociones y Cupones'],
  // ——— Evidencia y cierre ———
  ['c8', 'Evidencia fotográfica', 'foto', 68, 0, null],
  ['c9', 'Observaciones generales', 'texto', 69, 0, null],
];

const countChk = db.get('SELECT COUNT(*) as c FROM checklist_plantilla');
const countVisitas = db.get('SELECT COUNT(*) as c FROM visita_respuestas');
const hasOldChecklist = db.get("SELECT 1 FROM checklist_plantilla WHERE titulo LIKE '%Limpieza y orden%' OR titulo LIKE '%Atención al cliente%' LIMIT 1");
const runSeed = countChk.c === 0 ||
  (hasOldChecklist && countVisitas.c === 0) ||
  ([8, 39, 41, 50, 56, 63, 64, 66].includes(countChk.c) && countVisitas.c === 0);
if (runSeed) {
  if (countChk.c > 0) db.exec('DELETE FROM checklist_plantilla');
  for (const row of CHECKLIST_INTEGRAL) {
    db.run('INSERT INTO checklist_plantilla (id, titulo, tipo, orden, obligatorio, seccion) VALUES (?, ?, ?, ?, ?, ?)',
      [row[0], row[1], row[2], row[3], row[4], row[5] ?? null]);
  }
}
// Migración: asegurar que todos los ítems tengan seccion correcta (por si había datos antiguos)
for (const row of CHECKLIST_INTEGRAL) {
  const [id, , , , , seccion] = row;
  if (seccion != null) {
    try {
      db.run('UPDATE checklist_plantilla SET seccion = ? WHERE id = ?', [seccion, id]);
    } catch (_) {}
  }
}
// Migración: eliminar ítems Meta/Objetivo y Desviación (c1-1m, c1-2m, c1-3m, c1-4m, c1-6m)
for (const id of ['c1-1m', 'c1-2m', 'c1-3m', 'c1-4m', 'c1-6m']) {
  try {
    db.run('DELETE FROM visita_respuestas WHERE item_id = ?', [id]);
    db.run('DELETE FROM checklist_plantilla WHERE id = ?', [id]);
  } catch (_) {}
}
// Migración: Precisión en vez de Taste of Food (c1-3, c1-3e)
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Precisión: Dato actual (%)', 'c1-3']);
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Precisión Estatus', 'c1-3e']);
} catch (_) {}
// Migración: c1-4 Cantidad de encuestas, c1-4e Encuestas Estatus
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Cantidad de encuestas', 'c1-4']);
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Encuestas', 'c1-4e']);
} catch (_) {}
// Migración: agregar Porcentaje de mano de obra (c1-9)
try {
  const exists = db.get('SELECT 1 FROM checklist_plantilla WHERE id = ?', ['c1-9']);
  if (!exists) {
    db.run('INSERT INTO checklist_plantilla (id, titulo, tipo, orden, obligatorio, seccion) VALUES (?, ?, ?, ?, ?, ?)',
      ['c1-9', 'Porcentaje de mano de obra (%)', 'porcentaje', 23, 0, '1B. Pre-work: Costos y Control (Arguilea)']);
    db.run('UPDATE checklist_plantilla SET orden = orden + 1 WHERE orden >= 23 AND id != ?', ['c1-9']);
  }
} catch (_) {}
// Migración: agregar Envío de liquidaciones (c2-5)
try {
  const exists = db.get('SELECT 1 FROM checklist_plantilla WHERE id = ?', ['c2-5']);
  if (!exists) {
    db.run('INSERT INTO checklist_plantilla (id, titulo, tipo, orden, obligatorio, seccion) VALUES (?, ?, ?, ?, ?, ?)',
      ['c2-5', 'Envío de liquidaciones', 'texto', 28, 0, '2. Validación Financiera en Campo']);
    db.run('UPDATE checklist_plantilla SET orden = orden + 1 WHERE orden >= 28 AND id != ?', ['c2-5']);
  }
} catch (_) {}
// Migración: agregar Foto sucursal en Datos (dato-foto-sucursal)
try {
  const exists = db.get('SELECT 1 FROM checklist_plantilla WHERE id = ?', ['dato-foto-sucursal']);
  if (!exists) {
    db.run('INSERT INTO checklist_plantilla (id, titulo, tipo, orden, obligatorio, seccion) VALUES (?, ?, ?, ?, ?, ?)',
      ['dato-foto-sucursal', 'Evidencia fotográfica de la sucursal', 'foto', 0, 0, 'Datos de la Visita']);
  } else {
    db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Evidencia fotográfica de la sucursal', 'dato-foto-sucursal']);
  }
} catch (_) {}
// Migración: agregar Comedor limpio y mobiliario (c4-5)
try {
  const exists = db.get('SELECT 1 FROM checklist_plantilla WHERE id = ?', ['c4-5']);
  if (!exists) {
    db.run('INSERT INTO checklist_plantilla (id, titulo, tipo, orden, obligatorio, seccion) VALUES (?, ?, ?, ?, ?, ?)',
      ['c4-5', 'Comedor limpio y mobiliario en buen estado', 'estatus', 39, 0, '4. Mantenimiento e Imagen']);
    db.run('UPDATE checklist_plantilla SET orden = orden + 1 WHERE orden >= 39 AND id != ?', ['c4-5']);
  }
} catch (_) {}
// Migración: agregar sección Ventas (ventas-va, ventas-vaa, ventas-bg, ventas-pd, ventas-c)
const VENTAS_ITEMS = [
  ['ventas-va', 'Venta Actual Acumulada', 'texto', -5, 0, '1. Ventas'],
  ['ventas-vaa', 'Venta Año Anterior Acumulado', 'texto', -4, 0, '1. Ventas'],
  ['ventas-bg', 'Brecha(Gap)', 'texto', -3, 0, '1. Ventas'],
  ['ventas-pd', 'porcentaje de diferencia', 'porcentaje', -2, 0, '1. Ventas'],
  ['ventas-c', 'cumplimiento', 'texto', -1, 0, '1. Ventas'],
];
for (const row of VENTAS_ITEMS) {
  try {
    const exists = db.get('SELECT 1 FROM checklist_plantilla WHERE id = ?', [row[0]]);
    if (!exists) {
      db.run('INSERT INTO checklist_plantilla (id, titulo, tipo, orden, obligatorio, seccion) VALUES (?, ?, ?, ?, ?, ?)',
        [row[0], row[1], row[2], row[3], row[4], row[5]]);
    }
  } catch (_) {}
}
// Migración: Resultado Auditoría Meta >95%
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Resultado Global Auditoría: Dato actual (%) — Meta >95%', 'c1-5']);
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Resultado Auditoria: Puntos perdidos (ej.>95%)', 'c1-5m']);
} catch (_) {}
// Migración: Días de Inventario Meta 14 días
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Días de Inventario: Dato actual — Meta 14 días', 'c1-6']);
} catch (_) {}
// Migración: Validación de Faltantes Críticos (sin Arguilea)
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Validación de Faltantes Críticos', 'c2-1']);
} catch (_) {}
// Migración: Temperatura del Producto (sin Qualtrics)
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Temperatura del Producto: Tomar temp. de carnes y papas.', 'c3-1']);
} catch (_) {}
// Migración: Número empleados/gerentes a Recursos Humanos (c6-7, c6-8)
try {
  db.run('UPDATE checklist_plantilla SET seccion = ? WHERE id = ?', ['5. Recursos Humanos', 'c6-7']);
  db.run('UPDATE checklist_plantilla SET seccion = ? WHERE id = ?', ['5. Recursos Humanos', 'c6-8']);
} catch (_) {}
// Migración: Registro de Mermas (sin Waste)
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Registro de Mermas: ¿Se está pesando/contando la merma real o solo se digita?', 'c2-2']);
} catch (_) {}
// Migración: Verificar proceso de elaboración de productos
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Verificar proceso de elaboración de productos', 'c2-3']);
} catch (_) {}
// Migración: Productos químicos bajo llave y almacenes cerrados
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Todos los productos químicos están bajo llave y almacenes cerrados', 'c2-4']);
} catch (_) {}
// Migración: Temp. Carne solo °F
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Temp. Carne (°F)', 'c3-2']);
} catch (_) {}
// Migración: Exactitud de la Orden - 1 bolsa
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Exactitud de la Orden: Revisar 1 bolsa de entrega. ¿Está completa y con servilletas?', 'c3-5']);
} catch (_) {}
// Migración: Equipos Críticos - agregar equipos de refrigeración
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Equipos Críticos: ¿Funcionan al 100%? (Broiler, Freidoras, Helado y equipos de refrigeración).', 'c4-1']);
} catch (_) {}
// Migración: Wifi, A.C., música y TV
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Wifi, A.C., música y TV: ¿Funcionan correctamente para el cliente?', 'c4-3']);
} catch (_) {}
// Migración: Delivery y agregadores - sticker y ticket
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Delivery y agregadores: ¿Salen con sticker de seguridad y ticket?', 'c6-3']);
} catch (_) {}
// Migración: Exhibidor (Juguetes) en vez de Fantasiero
try {
  db.run('UPDATE checklist_plantilla SET titulo = ? WHERE id = ?', ['Exhibidor (Juguetes): ¿Está limpio, iluminado y lleno con los juguetes de la licencia actual?', 'c7-7']);
} catch (_) {}
if (!runSeed) {
  // Migración: insertar cualquier ítem de CHECKLIST_INTEGRAL que falte (DBs antiguas o parciales)
  for (const row of CHECKLIST_INTEGRAL) {
    const exists = db.get('SELECT id FROM checklist_plantilla WHERE id = ?', [row[0]]);
    if (!exists) {
      try {
        db.run('INSERT INTO checklist_plantilla (id, titulo, tipo, orden, obligatorio, seccion) VALUES (?, ?, ?, ?, ?, ?)',
          [row[0], row[1], row[2], row[3], row[4], row[5] ?? null]);
      } catch (_) {}
    }
  }
}

// Seed Burger King: Regiones, Distritos, Sucursales (60 restaurantes)
const countReg = db.get('SELECT COUNT(*) as c FROM regionales');
if (countReg.c === 0) {
  const regs = [
    ['reg-01', 'Región 01 - Gerencia Región Norte'],
    ['reg-02', 'Región 02'],
  ];
  for (const r of regs) db.run('INSERT INTO regionales (id, nombre) VALUES (?, ?)', r);

  const dists = [
    ['dist-01', 'reg-01', 'Distrito 01 - Tijuana, Tecate, Rosarito', 7],
    ['dist-02', 'reg-01', 'Distrito 02 - Ensenada', 4],
    ['dist-03', 'reg-01', 'Distrito 03 - Tijuana', 7],
    ['dist-04', 'reg-01', 'Distrito 04 - Mexicali', 7],
    ['dist-05', 'reg-01', 'Distrito 05 - Mexicali, SLRC', 5],
    ['dist-06', 'reg-01', 'Distrito 06 - Nogales, Obregón, Puerto Peñasco', 4],
    ['dist-07', 'reg-02', 'Distrito 07 - BCS', 5],
    ['dist-08', 'reg-02', 'Distrito 08 - Culiacán y Guasave', 7],
    ['dist-09', 'reg-02', 'Distrito 09 - Mazatlán y Tepic', 7],
    ['dist-10', 'reg-02', 'Distrito 10 - Durango y Torreón', 7],
  ];
  for (const d of dists) db.run('INSERT INTO distritos (id, regional_id, nombre) VALUES (?, ?, ?)', [d[0], d[1], d[2]]);

  let n = 0;
  const ciudades = ['Tijuana', 'Tecate', 'Rosarito', 'Ensenada', 'Mexicali', 'SLRC', 'Nogales', 'Obregón', 'Puerto Peñasco', 'La Paz', 'Culiacán', 'Guasave', 'Mazatlán', 'Tepic', 'Durango', 'Torreón'];
  for (const d of dists) {
    const [distId, , nombre] = d;
    const total = d[3];
    for (let i = 1; i <= total; i++) {
      n++;
      const fmt = n <= 31 ? 'free_standing' : n <= 50 ? 'food_court' : 'in_line';
      const ciudad = ciudades[(n - 1) % ciudades.length];
      db.run('INSERT INTO sucursales (id, distrito_id, nombre, formato) VALUES (?, ?, ?, ?)',
        [`suc-${String(n).padStart(3, '0')}`, distId, `BK ${ciudad} ${i}`, fmt]);
    }
  }
}

// Wrapper que expone prepare().run/get/all sin tocar el prepare nativo
const wrapper = {
  prepare: (sql) => ({
    run: (...params) => db.run(sql, params?.length ? params : undefined),
    get: (...params) => {
      const row = db.get(sql, params?.length ? params : undefined);
      return row === null || row === undefined ? undefined : row;
    },
    all: (...params) => db.all(sql, params?.length ? params : undefined),
  }),
  exec: (sql) => db.exec(sql),
};

export { wrapper as db };
export default wrapper;
