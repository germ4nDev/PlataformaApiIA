/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro - Widgets visibles por rol y por canal (regla 18, fase 2)
    Description: Qué widgets ve el usuario, sin red ni base de datos. Copia exacta de la web en
      PlataformaIA/src/app/plataforma/sesion/nucleo/widgets-visibles.ts; _pruebas/widgets-visibles.test.js corre las dos con los
      mismos casos: si se cambia una, se cambia la otra. La usa el tablero del teléfono (services/movil/tablero-movil.service.js).
      - Sin relación activa en PTL_WidgetsRoles para un rol del usuario = no lo ve. Sin permisos (null: no se pudieron leer)
        no se ve nada.
      - Canal del widget (PTL_WidgetsMaestro.canal, migración 030; antes movil = 1 → 'telefono'): 'web' | 'telefono' | 'ambos'.
      - Canal de quien pinta (OT-017):
          'web'      la web y la tableta: los 'web' y 'ambos' (un widget solo de teléfono no se ofrece).
          'telefono' la web embebida en el teléfono: solo 'telefono' y 'ambos'.
          'nativo'   la vista nativa de la app (respaldo sin conexión): todo lo permitido, como en CC-115.
      - Las tarjetas de terminal (TERM_SLOT_n, molde PTT_MAE_WGT_TERMINAL) son la zona dinámica de la pestaña, no un widget del
        catálogo: no tienen fila en el maestro ni en PTL_WidgetsRoles y se ven siempre.
      Un widget oculto no se borra del layout guardado: separarPorPermiso devuelve también los ocultos.
*/
const MOLDE_TERMINAL = 'PTT_MAE_WGT_TERMINAL';
const CANALES = ['web', 'telefono', 'ambos'];

const limpio = (v) => String(v ?? '').trim().toUpperCase();

/** Código del widget de una celda de la regla, un item de gridster o una fila del maestro. */
function codigoDe(item) {
  const c = limpio(item?.codigo || item?.type || item?.codigoWidget || item?.idClon);
  return /^TERM_SLOT_\d+$/.test(c) ? MOLDE_TERMINAL : c;
}

/** PTL_WidgetsMaestro.movil = 1 (migración 028). */
function esDeTelefono(widget) {
  const v = widget?.movil;
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
}

/** Canal del widget: canal (030) si es válido; si no, desde movil (028): 'telefono' o 'web'. */
function canalDe(widget) {
  const c = String(widget?.canal ?? '').trim().toLowerCase();
  if (CANALES.includes(c)) return c;
  return esDeTelefono(widget) ? 'telefono' : 'web';
}

/** De los widgets que permiten los roles (filas del maestro) a sus permisos; null si no hay lista. */
function permisosDeWidgets(widgets) {
  if (!Array.isArray(widgets)) return null;
  const de = (canal) => [...new Set(widgets.filter((w) => canalDe(w) === canal).map(codigoDe).filter(Boolean))];
  return {
    codigos: [...new Set(widgets.map(codigoDe).filter(Boolean))],
    telefono: de('telefono'),
    ambos: de('ambos'),
  };
}

/** @param {'web'|'telefono'|'nativo'} canal */
function widgetVisible(codigo, permisos, canal) {
  const c = codigoDe({ codigo });
  if (c === MOLDE_TERMINAL) return true;
  if (!permisos || !c) return false;
  if (!permisos.codigos.includes(c)) return false;
  if (canal === 'nativo') return true;
  const soloTelefono = permisos.telefono.includes(c);
  if (canal === 'telefono') return soloTelefono || (permisos.ambos || []).includes(c);
  return !soloTelefono;
}

/** Parte un layout en lo que se ve y lo que se oculta (lo oculto se conserva al guardar). */
function separarPorPermiso(items, permisos, canal) {
  const visibles = [];
  const ocultos = [];
  for (const item of items || []) (widgetVisible(codigoDe(item), permisos, canal) ? visibles : ocultos).push(item);
  return { visibles, ocultos };
}

module.exports = { MOLDE_TERMINAL, CANALES, codigoDe, esDeTelefono, canalDe, permisosDeWidgets, widgetVisible, separarPorPermiso };
