/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro - Widgets visibles por rol y por canal (regla 18, fase 2)
    Description: Qué widgets ve el usuario, sin red ni base de datos. Copia exacta de la web en
      PlataformaIA/src/app/plataforma/sesion/nucleo/widgets-visibles.ts; _pruebas/widgets-visibles.test.js corre las dos con los
      mismos casos: si se cambia una, se cambia la otra. La usa el tablero del teléfono (services/movil/tablero-movil.service.js).
      - Sin relación activa en PTLWidgetsRoles para un rol del usuario = no lo ve. Sin permisos (null: no se pudieron leer)
        no se ve nada.
      - PTLWidgetsMaestro.movil = 1 = widget de teléfono: solo el canal 'telefono'; la web y la tableta no lo ofrecen.
      - Las tarjetas de terminal (TERM_SLOT_n, molde PTT_MAE_WGT_TERMINAL) son la zona dinámica de la pestaña, no un widget del
        catálogo: no tienen fila en el maestro ni en PTLWidgetsRoles y se ven siempre.
      Un widget oculto no se borra del layout guardado: separarPorPermiso devuelve también los ocultos.
*/
const MOLDE_TERMINAL = 'PTT_MAE_WGT_TERMINAL';

const limpio = (v) => String(v ?? '').trim().toUpperCase();

/** Código del widget de una celda de la regla, un item de gridster o una fila del maestro. */
function codigoDe(item) {
  const c = limpio(item?.codigo || item?.type || item?.codigoWidget || item?.idClon);
  return /^TERM_SLOT_\d+$/.test(c) ? MOLDE_TERMINAL : c;
}

/** PTLWidgetsMaestro.movil = 1. */
function esDeTelefono(widget) {
  const v = widget?.movil;
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
}

/** De los widgets que permiten los roles (filas del maestro) a sus permisos; null si no hay lista. */
function permisosDeWidgets(widgets) {
  if (!Array.isArray(widgets)) return null;
  return {
    codigos: [...new Set(widgets.map(codigoDe).filter(Boolean))],
    telefono: [...new Set(widgets.filter(esDeTelefono).map(codigoDe).filter(Boolean))],
  };
}

/** @param {'web'|'telefono'} canal */
function widgetVisible(codigo, permisos, canal) {
  const c = codigoDe({ codigo });
  if (c === MOLDE_TERMINAL) return true;
  if (!permisos || !c) return false;
  if (!permisos.codigos.includes(c)) return false;
  return canal === 'telefono' || !permisos.telefono.includes(c);
}

/** Parte un layout en lo que se ve y lo que se oculta (lo oculto se conserva al guardar). */
function separarPorPermiso(items, permisos, canal) {
  const visibles = [];
  const ocultos = [];
  for (const item of items || []) (widgetVisible(codigoDe(item), permisos, canal) ? visibles : ocultos).push(item);
  return { visibles, ocultos };
}

module.exports = { MOLDE_TERMINAL, codigoDe, esDeTelefono, permisosDeWidgets, widgetVisible, separarPorPermiso };
