/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - Portal público de la DIMAR
    Description: Lee la página pública de capitanías y devuelve el primer titular sobre restricciones del canal
      (restricción, dragado, calado). Solo lectura de una página pública; no usa sesiones ni evita protecciones.
*/
const axios = require('axios');
const cheerio = require('cheerio');

const URL_CAPITANIAS = 'https://www.dimar.mil.co/capitanias-de-puerto';
const PALABRAS = ['RESTRICCIÓN', 'DRAGADO', 'CALADO'];

/** @returns {Promise<string|null>} titular encontrado o null (sin novedad). Lanza si la página no responde. */
async function titularRestriccionCanal() {
  const { data } = await axios.get(URL_CAPITANIAS, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    timeout: 10000,
  });
  const $ = cheerio.load(data);
  let encontrado = null;
  $('h3, .noticia-titulo, .titular, strong').each((_, el) => {
    const texto = $(el).text().trim();
    if (PALABRAS.some((p) => texto.toUpperCase().includes(p))) {
      encontrado = texto;
      return false;
    }
    return undefined;
  });
  return encontrado;
}

module.exports = { titularRestriccionCanal };
