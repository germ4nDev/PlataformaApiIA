/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Catálogo simulado de nodos de capacidad (OT-009, 2026-10-29)
    Description: Sin base de datos ni red; lo usan simulador-operacion.service.js y las pruebas.
      Si un puerto no tiene nodos en TCL_CapacidadNodos, propone los suyos (decisión del usuario 2026-10-29: catálogos
      simulados rotulados SIMULADO), con las mismas categorías del catálogo de referencia:
        TERMINAL (una por terminal del maestro, en toneladas), PATIO_CONTENEDOR y DEPOT_VACIOS (TEU), PATIO_PDI
        (unidades; uno de importación y otro de exportación si el puerto es mediano) y PATIO_BREAKBULK (m²).
      Cuántos y de qué tamaño sale de los muelles del puerto, nada fijo a un puerto. Ids 'SIM-<categoría>-<n>' y
      fuente SIMULADOR: así se distinguen de los reales y se retiran solos cuando llegue el catálogo real.
*/
const { rngDe } = require('./simulador-gate');

const entre = (rng, a, b) => a + (b - a) * rng();
const redondeo = (n, paso) => Math.max(paso, Math.round(n / paso) * paso);

/**
 * @param {string} clave  puerto (semilla)
 * @param {{ id_terminal: string, nombre?: string, muelles?: number }[]} terminales  del maestro
 * @returns {object[]} filas de TCL_CapacidadNodos (sin id_puerto: lo pone el servicio)
 */
function catalogoNodos(clave, terminales = []) {
  const lista = terminales.length ? terminales : [{ id_terminal: 'TERMINAL', nombre: 'Terminal multipropósito', muelles: 1 }];
  const muelles = lista.reduce((t, x) => t + Math.max(1, Number(x.muelles) || 0), 0);
  const rng = rngDe(`${clave}|catalogo-nodos`);
  const nodo = (categoria, n, nombre, unidad, capacidad, operaciones, extra = {}) => ({
    id_nodo: `SIM-${categoria.replace(/_.*/, '')}${categoria.includes('_') ? '-' + categoria.split('_')[1].slice(0, 3) : ''}-${n}`,
    nombre, categoria, operador: null, unidad_capacidad: unidad, capacidad, descripcion_capacidad: null,
    operaciones, id_terminal: null, ...extra,
  });
  const nodos = [];
  lista.forEach((t, i) => {
    const m = Math.max(1, Number(t.muelles) || 0);
    nodos.push(nodo('TERMINAL', i + 1, t.nombre || t.id_terminal, 'TON', redondeo(entre(rng, 9000, 14000) * m, 1000),
      'Descargue|Cargue|Almacenamiento', { id_terminal: t.id_terminal || null }));
  });
  const patios = Math.max(1, Math.min(3, Math.round(muelles / 6)));
  for (let i = 1; i <= patios; i++) {
    nodos.push(nodo('PATIO_CONTENEDOR', i, `Patio de contenedores ${i}`, 'TEU', redondeo(entre(rng, 250, 450) * muelles / patios, 100),
      'Almacenamiento lleno|Inspección|Conexión reefer'));
  }
  const depots = muelles >= 8 ? 2 : 1;
  for (let i = 1; i <= depots; i++) {
    nodos.push(nodo('DEPOT_VACIOS', i, `Depósito de vacíos ${i}`, 'TEU', redondeo(entre(rng, 150, 300) * muelles / depots, 100),
      'Devolución vacío|Reparación|Limpieza'));
  }
  nodos.push(nodo('PATIO_PDI', 1, 'Patio de vehículos · importación', 'UNIDADES', redondeo(entre(rng, 25, 45) * muelles, 10), 'Recibo Ro-Ro|PDI|Despacho en niñera'));
  if (muelles >= 4) nodos.push(nodo('PATIO_PDI', 2, 'Patio de vehículos · exportación', 'UNIDADES', redondeo(entre(rng, 10, 20) * muelles, 10), 'Parqueo pre-embarque'));
  nodos.push(nodo('PATIO_BREAKBULK', 1, 'Patio de carga suelta', 'M2', redondeo(entre(rng, 600, 1100) * muelles, 100), 'Almacenamiento|Project cargo'));
  return nodos;
}

module.exports = { catalogoNodos };
