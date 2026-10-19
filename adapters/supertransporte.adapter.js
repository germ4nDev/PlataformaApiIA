/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - Supertransporte (datos.gov.co, conjunto 5r3g-zv5z)
    Description: Tráfico portuario marítimo publicado por la Superintendencia de Transporte (anual, con rezago).
      El filtro de zona se limpia antes de armar la consulta SoQL (solo letras, números, espacio y guion bajo).
      Lanza si la fuente no responde: el servicio decide el respaldo.
*/
const axios = require('axios');

const URL = 'https://www.datos.gov.co/resource/5r3g-zv5z.json';
const cabeceras = () => (process.env.SOCRATA_APP_TOKEN ? { 'X-App-Token': process.env.SOCRATA_APP_TOKEN } : {});
const limpiarZona = (zona) => String(zona || 'BUENAVENTURA').toUpperCase().trim().replace(/[^A-Z0-9ÁÉÍÓÚÑ _]/g, '');

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
    params: { zona_portuaria: limpiarZona(zona), $where: `a_o_vigencia >= '${Number(desdeAnio) || 0}'`, $limit: limite },
  });
  return data;
}

module.exports = { traficoPorZona, traficoDesdeAnio };
