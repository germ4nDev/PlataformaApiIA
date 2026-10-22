/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - Noticias e indicadores (Google News RSS, GNews, TRM de datos.gov.co)
    Description: Solo lee de la fuente y devuelve objetos planos; no escribe en la base ni en disco.
      - googleNews(consulta): RSS público de Google News para Colombia (sin clave).
      - gnews(consulta): API de GNews; requiere GNEWS_API_KEY en el .env (100 consultas al día en el plan gratuito).
        Sin clave devuelve [] (no es un error).
      - trm(): últimas tasas representativas del mercado publicadas en datos.gov.co (conjunto 32sa-8pi3).
      Formato de cada noticia: { titulo, url, fecha, medio, resumen }.
      Lanza si la fuente no responde: el servicio decide (registra el fallo y sigue con lo guardado).
*/
const axios = require('axios');
const cheerio = require('cheerio');

const http = axios.create({ timeout: 20000, headers: { 'User-Agent': 'Porttos-TorreControl/1.0 (noticias del sector)' } });
const URL_GOOGLE = 'https://news.google.com/rss/search';
const URL_GNEWS = 'https://gnews.io/api/v4/search';
const URL_TRM = 'https://www.datos.gov.co/resource/32sa-8pi3.json';

async function googleNews(consulta) {
  const { data } = await http.get(URL_GOOGLE, { params: { q: consulta, hl: 'es-419', gl: 'CO', ceid: 'CO:es-419' }, responseType: 'text' });
  const $ = cheerio.load(data, { xmlMode: true });
  return $('item').map((_, el) => {
    const it = $(el);
    return {
      titulo: it.find('title').first().text(),
      url: it.find('link').first().text(),
      fecha: it.find('pubDate').first().text(),
      medio: it.find('source').first().text() || null,
      resumen: null,   // la descripción de Google News es HTML con el mismo titular: no aporta
    };
  }).get();
}

async function gnews(consulta) {
  const clave = process.env.GNEWS_API_KEY;
  if (!clave) return [];
  const { data } = await http.get(URL_GNEWS, { params: { q: consulta, lang: 'es', country: 'co', max: 20, apikey: clave } });
  return (data?.articles || []).map((a) => ({
    titulo: a.title, url: a.url, fecha: a.publishedAt, medio: a.source?.name || null, resumen: a.description || null,
  }));
}

/** Últimas 'n' TRM: [{ fecha (ISO de vigencia), valor }]. */
async function trm(n = 5) {
  const cabeceras = process.env.SOCRATA_APP_TOKEN ? { 'X-App-Token': process.env.SOCRATA_APP_TOKEN } : {};
  const { data } = await http.get(URL_TRM, { headers: cabeceras, params: { $order: 'vigenciadesde DESC', $limit: n } });
  return (data || []).map((f) => ({ fecha: new Date(f.vigenciadesde).toISOString(), valor: Number(f.valor) }))
    .filter((f) => Number.isFinite(f.valor) && f.valor > 0);
}

module.exports = { googleNews, gnews, trm };
