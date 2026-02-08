import { openDB } from 'idb';

const DB = 'app-uli';
const STORE_VISITAS = 'visitas_pendientes';
const STORE_CACHE = 'cache';

export const CACHE_KEYS = {
  REGIONALES: 'regionales',
  PLANTILLA: 'checklist_plantilla_v3',
  DISTRITOS: 'distritos',
  SUCURSALES: 'sucursales',
};

export async function getDB() {
  return openDB(DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_VISITAS)) {
        db.createObjectStore(STORE_VISITAS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
      }
    },
  });
}

export async function guardarVisitaOffline(visita) {
  const db = await getDB();
  await db.put(STORE_VISITAS, { ...visita, _offline: true, _updated: Date.now() });
}

export async function listarVisitasOffline() {
  const db = await getDB();
  return db.getAll(STORE_VISITAS);
}

export async function eliminarVisitaOffline(id) {
  const db = await getDB();
  await db.delete(STORE_VISITAS, id);
}

export async function setCache(key, data) {
  const db = await getDB();
  await db.put(STORE_CACHE, { key, data, updated: Date.now() });
}

export async function getCache(key) {
  const db = await getDB();
  const row = await db.get(STORE_CACHE, key);
  return row?.data;
}

const DRAFT_KEY = 'nueva_visita_draft';
export async function guardarDraftOffline(draft) {
  await setCache(DRAFT_KEY, draft);
}
export async function obtenerDraftOffline() {
  return getCache(DRAFT_KEY);
}
export async function limpiarDraftOffline() {
  const db = await getDB();
  await db.delete(STORE_CACHE, DRAFT_KEY);
}

export function isOnline() {
  return typeof navigator !== 'undefined' && navigator.onLine;
}
