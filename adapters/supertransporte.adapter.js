/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - Supertransporte (datos.gov.co, conjunto 5r3g-zv5z)
    Description: Tráfico portuario marítimo publicado por la Superintendencia de Transporte (mensual, con rezago).
      El filtro de zona se limpia antes de armar la consulta SoQL (letras, números, espacio, punto y guion bajo: la zona
      de Coveñas es 'G. MORROSQUILLO'). Lanza si la fuente no responde: el servicio decide el respaldo.
      Corregido 2026-10-29 (OT-009): el año de vigencia se llama 'anno_vigencia' (antes 'a_o_vigencia': la consulta por
      año fallaba siempre y el Análisis de tráfico salía sin datos en todos los puertos).
*/
const axios = require('axios');

const URL = 'https://www.datos.gov.co/resource/5r3g-zv5z.json';
const cabeceras = () => (process.env.SOCRATA_APP_TOKEN ? { 'X-App-Token': process.env.SOCRATA_APP_TOKEN } : {});
const limpiarZona = (zona) => String(zona || 'BUENAVENTURA').toUpperCase().trim().replace(/[^A-Z0-9ÁÉÍÓÚÑ ._]/g, '');

/** Filas cuya zona portuaria contiene el texto indicado. */
async function traficoPorZona(zona, limite = 4000) {
  const { data } = await axios.get(URL, {
    headers: cabeceras(),
    params: { $where: `upper(zona_portuaria) like '%${limpiarZona(zona)}%'`, $limit: limite },
  });
  return data;
}

/** Filas de una zona exacta desde un año de vigencia. */
async function traficoDesdeAnio(zona, desdeAnio, limite = 50000) {
  const { data } = await axios.get(URL, {
    headers: cabeceras(),
    params: { zona_portuaria: limpiarZona(zona), $where: `anno_vigencia >= '${Number(desdeAnio) || 0}'`, $limit: limite },
  });
  return data;
}

/**
 * Toneladas por año, mes y tipo de carga de una zona exacta desde un año (sumadas en la fuente; OT-009).
 * Devuelve { anno_vigencia, mes_vigencia, tipo_carga, expo, impo, trans, transito, fluv, cab } como texto.
 */
async function mensualPorZona(zona, desdeAnio) {
  const { data } = await axios.get(URL, {
    headers: cabeceras(),
    timeout: 30000,
    params: {
      $select: 'anno_vigencia, mes_vigencia, tipo_carga, sum(exportacion) as expo, sum(importacion) as impo, sum(transbordo) as trans, '
        + 'sum(transito_internacional) as transito, sum(fluvial) as fluv, sum(cabotaje) as cab',
      $where: `zona_portuaria = '${limpiarZona(zona)}' AND anno_vigencia >= '${Number(desdeAnio) || 0}'`,
      $group: 'anno_vigencia, mes_vigencia, tipo_carga',
      $limit: 5000,
    },
  });
  return data;
}

module.exports = { traficoPorZona, traficoDesdeAnio, mensualPorZona };
