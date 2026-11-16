/*
    Author: German Valencia
    Pattern: PLATAFORMA Núcleo puro - Sitios: catálogo de los websites de cada aplicación (OT-036 fase 2, CC-207; AD-16)
    Cada sitio dice de qué aplicación es, su dirección pública y la ruta de la plataforma donde esa aplicación administra su contenido
    (rutaAdministracion, la declara el manifiesto de la app en websites[].administracion). El núcleo no conoce el contenido (regla 26).
      normalizar(body)          trim, código en MAYÚSCULAS, puerto por defecto según el protocolo, '' → null
      revisar(s, { nuevo })     [] o la lista de { campo, mensaje }
*/
const t = (v) => (v === undefined || v === null ? '' : String(v).trim());
const CODIGO = /^[A-Z0-9_]{2,200}$/;
const URL = /^https?:\/\/[^\s/]+[^\s]*$/;
const RUTA = /^\/[A-Za-z0-9/_-]*$/;

function normalizar(b = {}) {
  const url = t(b.urlSitio);
  const puerto = t(b.puertoSitio) === '' ? (url.startsWith('https://') ? 443 : 80) : Number(b.puertoSitio);
  return {
    codigoSitio: t(b.codigoSitio).toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
    codigoAplicacion: t(b.codigoAplicacion),
    nombreSitio: t(b.nombreSitio),
    descripcionSitio: t(b.descripcionSitio),
    urlSitio: url.replace(/\/+$/, ''),
    puertoSitio: puerto,
    estadoSitio: b.estadoSitio === undefined || b.estadoSitio === null || b.estadoSitio === '' ? true : b.estadoSitio === true || b.estadoSitio === 1 || b.estadoSitio === '1' || b.estadoSitio === 'true',
    rutaAdministracion: t(b.rutaAdministracion) === '' ? null : t(b.rutaAdministracion),
  };
}

function revisar(s, { nuevo = true } = {}) {
  const e = [];
  const mal = (campo, mensaje) => e.push({ campo, mensaje });
  if (nuevo && !CODIGO.test(s.codigoSitio)) mal('codigoSitio', 'Código en MAYÚSCULAS con letras, números y _ (2 a 200).');
  if (!s.codigoAplicacion) mal('codigoAplicacion', 'La aplicación es obligatoria.');
  if (!s.nombreSitio || s.nombreSitio.length > 100) mal('nombreSitio', 'El nombre es obligatorio (máx. 100).');
  if (s.descripcionSitio.length > 4000) mal('descripcionSitio', 'Descripción de máximo 4000 caracteres.');
  if (!URL.test(s.urlSitio) || s.urlSitio.length > 100) mal('urlSitio', 'Dirección completa con http:// o https:// (máx. 100).');
  if (!Number.isInteger(s.puertoSitio) || s.puertoSitio < 1 || s.puertoSitio > 65535) mal('puertoSitio', 'Puerto de 1 a 65535.');
  if (s.rutaAdministracion !== null && (!RUTA.test(s.rutaAdministracion) || s.rutaAdministracion.length > 200)) {
    mal('rutaAdministracion', 'Ruta de la plataforma que empieza por / (ej. /porttos/portal-panel).');
  }
  return e;
}

module.exports = { normalizar, revisar };
