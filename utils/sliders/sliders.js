/*
    Author: German Valencia
    Pattern: PLATAFORMA Util (núcleo puro, AD-16) - Slides del login por aplicación (migración 027, CC-104)
    Description: Sin acceso a datos ni red, probado en _pruebas/login-portal.test.js:
      paraDeConsulta(valor)        ?para= de GET /api/sliders: un código de aplicación, 'general' o null (sin filtro: la gestión)
      slidesPara(lista, para)      lo que muestra el login: activos de esa aplicación; si no tiene, los generales
                                   (codigoAplicacion NULL); 'general' = solo los generales. Ordenados por nombre (como antes)
*/

const texto = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());

/** Código de aplicación seguro (los de la plataforma son GUID o códigos cortos); lo demás no filtra. */
function paraDeConsulta(valor) {
  const v = texto(valor);
  if (!v) return null;
  if (v.toLowerCase() === 'general') return 'general';
  return /^[A-Za-z0-9_-]{1,200}$/.test(v) ? v : null;
}

const activo = (s) => s && (s.estadoSlider === true || s.estadoSlider === 1 || s.estadoSlider === '1');
const porNombre = (a, b) => String(a.nombreSlider || '').localeCompare(String(b.nombreSlider || ''), 'es');

function slidesPara(lista = [], para = null) {
  const todos = Array.isArray(lista) ? lista : [];
  if (!para) return todos;                                    // gestión: todos, como siempre
  const activos = todos.filter(activo);
  const generales = activos.filter((s) => !texto(s.codigoAplicacion));
  if (para === 'general') return generales.sort(porNombre);
  const propios = activos.filter((s) => texto(s.codigoAplicacion) === para);
  return (propios.length ? propios : generales).sort(porNombre);
}

module.exports = { paraDeConsulta, slidesPara };
