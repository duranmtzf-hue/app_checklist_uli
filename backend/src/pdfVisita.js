import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_BASE = path.join(__dirname, '..', 'uploads');

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 14;
const MIN_Y = MARGIN + 40;
const BLUE = { r: 0.18, g: 0.31, b: 0.65 };    // Azul moderno (#2E5090)

/** Convierte texto a caracteres que la fuente PDF (WinAnsi) puede mostrar. Evita error "WinAnsi cannot encode". */
function toWinAnsi(str) {
  if (str == null) return '';
  let s = String(str);
  s = s.replace(/\u{1F7E2}/gu, '[Verde]').replace(/\u{1F7E1}/gu, '[Amarillo]').replace(/\u{1F534}/gu, '[Rojo]');
  return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim() || '';
}
const GOLD = { r: 0.95, g: 0.77, b: 0.2 };     // Dorado vibrante (#F2C43D)
const WHITE = { r: 1, g: 1, b: 1 };
const DARK = { r: 0.11, g: 0.13, b: 0.16 };
const GRAY = { r: 0.42, g: 0.46, b: 0.52 };
const SUCCESS = { r: 0.2, g: 0.75, b: 0.4 };
const WARNING = { r: 0.9, g: 0.45, b: 0.1 };

/**
 * Envuelve texto para que no exceda maxWidth. Devuelve array de líneas.
 */
function wrapText(text, font, fontSize, maxWidth) {
  const str = toWinAnsi(text);
  if (!str) return [''];
  const safeWidth = Math.max(30, maxWidth);
  const lines = [];
  const words = str.split(/\s+/).filter(Boolean);
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const w = font.widthOfTextAtSize(testLine, fontSize);
    if (w <= safeWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      const wordW = font.widthOfTextAtSize(word, fontSize);
      if (wordW > safeWidth) {
        let chunk = '';
        for (const char of word) {
          const test = chunk + char;
          if (font.widthOfTextAtSize(test, fontSize) > safeWidth && chunk) {
            lines.push(chunk);
            chunk = char;
          } else chunk = test;
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [''];
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return '-';
  try {
    const d = new Date(fechaStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return String(fechaStr).slice(0, 20);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(fechaStr).slice(0, 20);
  }
}

function valorRespuesta(r) {
  if (r.tipo === 'si_no') return r.valor_si_no === 1 ? 'Sí' : r.valor_si_no === 0 ? 'No' : '-';
  if (r.tipo === 'porcentaje' && r.valor_porcentaje != null) return `${r.valor_porcentaje}%`;
  if (r.tipo === 'numero' && r.valor_numero != null) return String(r.valor_numero);
  if (r.tipo === 'estatus' && r.valor_numero != null) return r.valor_numero === 1 ? 'Cumple' : r.valor_numero === 2 ? 'Atención' : 'No cumple';
  if (r.tipo === 'texto' && r.valor_texto) return String(r.valor_texto).slice(0, 500);
  if (r.tipo === 'foto' && r.valor_foto_path) return 'Adjunta';
  return null;
}

export async function generarPDFVisita(visita) {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;
  let page = doc.addPage();
  const pages = [page];

  const addPageIfNeeded = (neededHeight) => {
    if (y - neededHeight < MIN_Y) {
      page = doc.addPage();
      pages.push(page);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawText = (text, opts = {}) => {
    const { size = 10, bold = false, color = DARK, maxW = CONTENT_WIDTH - 20 } = opts;
    const font = bold ? helveticaBold : helvetica;
    const lines = wrapText(toWinAnsi(text), font, size, maxW);
    const lineH = Math.max(LINE_HEIGHT, size + 4);
    for (const ln of lines) {
      addPageIfNeeded(lineH + 4);
      page.drawText(ln, {
        x: MARGIN + 10,
        y: y - 10,
        size,
        font,
        color: rgb(color.r, color.g, color.b),
      });
      y -= lineH;
    }
    y -= 6;
  };

  const drawSection = (title, color = BLUE) => {
    addPageIfNeeded(44);
    page.drawRectangle({
      x: MARGIN,
      y: y - 30,
      width: 4,
      height: 30,
      color: rgb(color.r, color.g, color.b),
    });
    page.drawRectangle({
      x: MARGIN,
      y: y - 30,
      width: CONTENT_WIDTH,
      height: 30,
      color: rgb(0.98, 0.98, 0.99),
    });
    page.drawText(toWinAnsi(title), {
      x: MARGIN + 16,
      y: y - 21,
      size: 12,
      font: helveticaBold,
      color: rgb(color.r, color.g, color.b),
    });
    y -= 40;
  };

  // ——— ENCABEZADO MODERNO (fondo azul, texto blanco, acento dorado) ———
  const HEADER_H = 80;
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_H,
    width: PAGE_WIDTH,
    height: HEADER_H,
    color: rgb(BLUE.r, BLUE.g, BLUE.b),
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_H,
    width: PAGE_WIDTH,
    height: 3,
    color: rgb(GOLD.r, GOLD.g, GOLD.b),
  });
  page.drawText(toWinAnsi('REPORTE DE VISITA'), {
    x: MARGIN,
    y: PAGE_HEIGHT - 42,
    size: 24,
    font: helveticaBold,
    color: rgb(WHITE.r, WHITE.g, WHITE.b),
  });
  page.drawText(toWinAnsi('Checklist Integral de Gestión · Burger King'), {
    x: MARGIN,
    y: PAGE_HEIGHT - 62,
    size: 11,
    font: helvetica,
    color: rgb(0.95, 0.95, 0.98),
  });
  y = PAGE_HEIGHT - 96;

  // ——— DATOS DE LA VISITA ———
  drawSection('DATOS DE LA VISITA');
  const datos = [
    `Sucursal: ${toWinAnsi(visita.sucursal_nombre) || '-'}`,
    `Regional: ${toWinAnsi(visita.regional_nombre) || '-'}  |  Distrito: ${toWinAnsi(visita.distrito_nombre) || '-'}`,
    `Fecha: ${toWinAnsi(formatearFecha(visita.fecha))}`,
    `Gerente: ${toWinAnsi(visita.gerente) || '-'}`,
    `Evaluador: ${toWinAnsi(visita.usuario_nombre) || 'Ulises Sanchez'}`,
  ];
  for (const d of datos) drawText(d, { size: 10, color: DARK });
  y -= 12;

  // ——— RESULTADOS (Cumplió / No cumplió) ———
  const respuestas = visita.respuestas || [];
  const siCumple = respuestas.filter(r => r.tipo === 'si_no' && r.valor_si_no === 1);
  const noCumple = respuestas.filter(r => r.tipo === 'si_no' && r.valor_si_no === 0);
  addPageIfNeeded(50);
  page.drawRectangle({
    x: MARGIN,
    y: y - 28,
    width: CONTENT_WIDTH / 2 - 8,
    height: 28,
    color: rgb(SUCCESS.r, SUCCESS.g, SUCCESS.b),
    opacity: 0.12,
  });
  page.drawText(toWinAnsi(`Cumplió: ${siCumple.length} ítems`), {
    x: MARGIN + 12,
    y: y - 18,
    size: 11,
    font: helveticaBold,
    color: rgb(0.15, 0.5, 0.3),
  });
  page.drawRectangle({
    x: MARGIN + CONTENT_WIDTH / 2 + 8,
    y: y - 28,
    width: CONTENT_WIDTH / 2 - 8,
    height: 28,
    color: rgb(WARNING.r, WARNING.g, WARNING.b),
    opacity: 0.12,
  });
  page.drawText(toWinAnsi(`No cumplió: ${noCumple.length} ítems`), {
    x: MARGIN + CONTENT_WIDTH / 2 + 20,
    y: y - 18,
    size: 11,
    font: helveticaBold,
    color: rgb(0.6, 0.35, 0.1),
  });
  y -= 44;

  // ——— CHECKLIST POR SECCIONES ———
  const bySeccion = {};
  for (const r of respuestas) {
    const sec = r.seccion || 'Otros';
    if (!bySeccion[sec]) bySeccion[sec] = [];
    bySeccion[sec].push(r);
  }
  const ordenSeccion = [
    'Datos de la Visita',
    '1A. Pre-work: Satisfacción (Qualtrics)',
    '1B. Pre-work: Costos y Control (Arguilea)',
    '2. Validación Financiera en Campo',
    '3. Calidad y Experiencia (Qualtrics)',
    '4. Mantenimiento e Imagen',
    '5. Recursos Humanos',
    '6. Delivery y Agregadores',
    '7A. Mercadotecnia: Precios y Menú Board',
    '7B. Mercadotecnia: Material P.O.P.',
    '7C. Mercadotecnia: Juguetes (King Jr)',
    '7D. Mercadotecnia: Promociones y Cupones',
    'Otros',
  ];
  const seccionesOrd = ordenSeccion.filter(s => bySeccion[s]?.length);

  for (const seccion of seccionesOrd) {
    const items = bySeccion[seccion];
    if (!items?.length) continue;
    drawSection(seccion);
    for (const r of items) {
      const valor = valorRespuesta(r);
      const titulo = toWinAnsi((r.titulo || '').slice(0, 300));
      drawText(titulo, { size: 8, color: GRAY, maxW: CONTENT_WIDTH - 80 });
      if (r.tipo === 'foto' && r.valor_foto_path && !String(r.valor_foto_path).startsWith('blob:')) {
        try {
          const relPath = String(r.valor_foto_path).replace(/^[/\\]+/, '').replace(/\\/g, '/');
          const imgPath = path.join(UPLOAD_BASE, path.basename(relPath));
          const altPath = path.join(__dirname, '..', relPath);
          const resolvedPath = fs.existsSync(imgPath) ? imgPath : (fs.existsSync(altPath) ? altPath : null);
          if (resolvedPath) {
            let bytes = fs.readFileSync(resolvedPath);
            const ext = path.extname(resolvedPath).toLowerCase();
            if (ext === '.webp' || ext === '.gif' || ext === '.avif') {
              bytes = await sharp(bytes).png().toBuffer();
            } else if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
              try {
                bytes = await sharp(bytes).png().toBuffer();
              } catch (_) {}
            }
            const IMG_MAX = 180;
            addPageIfNeeded(IMG_MAX + 30);
            let img;
            if (ext === '.png' || (bytes[0] === 0x89 && bytes[1] === 0x50)) {
              img = await doc.embedPng(bytes);
            } else {
              img = await doc.embedJpg(bytes);
            }
            const scale = Math.min(IMG_MAX / img.width, IMG_MAX / img.height, 1);
            page.drawImage(img, {
              x: MARGIN + 10,
              y: y - img.height * scale,
              width: img.width * scale,
              height: img.height * scale,
            });
            y -= img.height * scale + 16;
          } else {
            drawText('  Evidencia fotográfica: (archivo no encontrado)', { size: 8, color: GRAY });
          }
        } catch (err) {
          console.error('PDF imagen:', err);
          drawText('  Evidencia fotográfica: (error al cargar imagen)', { size: 8, color: GRAY });
        }
      } else if (valor != null) {
        drawText(`  Respuesta: ${toWinAnsi(String(valor)).slice(0, 200)}`, { size: 8, bold: true });
      }
      if (r.observaciones) {
        drawText(`  Obs: ${toWinAnsi(String(r.observaciones)).slice(0, 300)}`, { size: 7, color: GRAY });
      }
      y -= 2;
    }
    y -= 8;
  }

  // ——— PLAN DE ACCIÓN ———
  if (visita.plan_financiero || visita.plan_experiencia || visita.plan_operativo || visita.plan_accion) {
    drawSection('PLAN DE ACCIÓN INTEGRADO', BLUE);
    const planes = [
      { label: '1. Financieros / Costos', text: visita.plan_financiero },
      { label: '2. Experiencia Cliente', text: visita.plan_experiencia },
      { label: '3. Operativo / Mantenimiento', text: visita.plan_operativo },
      { label: 'Comentarios Adicionales', text: visita.plan_accion },
    ].filter(p => p.text);
    for (const { label, text } of planes) {
      addPageIfNeeded(30);
      page.drawText(toWinAnsi(label), {
        x: MARGIN + 10,
        y: y - 8,
        size: 9,
        font: helveticaBold,
        color: rgb(BLUE.r, BLUE.g, BLUE.b),
      });
      y -= 16;
      drawText(toWinAnsi(String(text)).slice(0, 1500), { size: 9, maxW: CONTENT_WIDTH - 24 });
      y -= 8;
    }
    addPageIfNeeded(50);
    drawText('Firma Gerente: _________________________', { size: 9, color: GRAY });
    drawText('Firma Operaciones: _________________________', { size: 9, color: GRAY });
    y -= 20;
  }

  // ——— PIE DE PÁGINA ———
  const totalPages = doc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = doc.getPage(i);
    const footer = `Página ${i + 1} de ${totalPages}  ·  ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}  ·  APP Checklist`;
    p.drawText(toWinAnsi(footer), {
      x: MARGIN,
      y: 24,
      size: 7,
      font: helvetica,
      color: rgb(GRAY.r, GRAY.g, GRAY.b),
    });
  }

  return await doc.save();
}
