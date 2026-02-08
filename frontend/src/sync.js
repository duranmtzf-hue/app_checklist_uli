import { listarVisitasOffline, eliminarVisitaOffline } from './store';
import { visitas as apiVisitas } from './api';

/**
 * Sincroniza visitas guardadas offline con el servidor cuando hay conexión.
 * Llamar al iniciar la app y cuando navigator.onLine pase a true.
 */
export async function sincronizarVisitasPendientes() {
  if (!navigator.onLine) return { synced: 0, errors: [] };
  const pendientes = await listarVisitasOffline();
  let synced = 0;
  const errors = [];
  for (const v of pendientes) {
    try {
      const payload = {
        sucursal_id: v.sucursal_id,
        fecha: v.fecha,
        plan_accion: v.plan_accion,
        plan_financiero: v.plan_financiero,
        plan_experiencia: v.plan_experiencia,
        plan_operativo: v.plan_operativo,
        gerente: v.gerente,
        respuestas: v.respuestas || [],
        estado: 'completada',
      };
      await apiVisitas.create(payload);
      await eliminarVisitaOffline(v.id);
      synced++;
    } catch (e) {
      errors.push({ id: v.id, message: e.message });
    }
  }
  return { synced, errors };
}
