/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Históricos de Supertransporte (OT-009, 2026-10-29)
    Description: Sin base de datos ni red. Convierte las sumas mensuales del conjunto público de Supertransporte
      (adapters/supertransporte.adapter.js → mensualPorZona) en filas de TCL_HistoricosSupertransporte: dato REAL oficial
      (decisión del usuario 2026-10-29), con fuente 'SUPERTRANSPORTE' y simulado = 0.
      total_toneladas = exportación + importación + transbordo + tránsito internacional + fluvial + cabotaje.
      Filas con año, mes o tipo de carga ilegibles se descartan (no se inventan).
*/
const FUENTE = 'SUPERTRANSPORTE';
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * @param {object[]} filas  respuesta de mensualPorZona
 * @param {{ zona: string, idPuerto: string }} puerto
 */
function filasHistorico(filas, { zona, idPuerto }) {
  const salida = [];
  for (const f of filas || []) {
    const anio = parseInt(f.anno_vigencia, 10);
    const mes = parseInt(f.mes_vigencia, 10);
    const tipo = String(f.tipo_carga || '').trim().toUpperCase();
    if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12 || !tipo) continue;
    const total = num(f.expo) + num(f.impo) + num(f.trans) + num(f.transito) + num(f.fluv) + num(f.cab);
    salida.push({
      anio, mes, zona_portuaria: zona, tipo_carga: tipo, total_toneladas: Math.round(total * 100) / 100,
      fecha_reporte_super: `${anio}-${String(mes).padStart(2, '0')}-01`, id_puerto: idPuerto, fuente: FUENTE, simulado: 0,
    });
  }
  return salida.sort((a, b) => a.anio - b.anio || a.mes - b.mes || a.tipo_carga.localeCompare(b.tipo_carga));
}

module.exports = { FUENTE, filasHistorico };
