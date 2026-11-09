/*
    Author: German Valencia
    Pattern: PLATAFORMA Núcleo puro - Dominios de la plataforma (OT-012, migración 026)
    Un despliegue, varios dominios: el dominio del navegador decide la aplicación. Sin acceso a datos (AD-16, con prueba en
    _pruebas/dominios.test.js).
      normalizarHost(valor)               'https://WWW.Porttos.co:443/x' → 'www.porttos.co'; vacío o inválido → ''
      hostDeOrigen(origin, referer)       host del encabezado Origin (o Referer); sin ellos → ''
      indexar(filas)                      Map dominio → fila activa y válida (las inactivas o mal formadas no entran)
      contextoDe(host, indice)            { tipo: 'consola' | 'aplicacion' | 'neutro', dominio, codigoAplicacion, codigoSuite,
                                            rutaPortal, rutaInicio, marca: { nombre, logo } }. Desconocido → neutro (nunca consola)
      puedeEntrar(contexto, appsUsuario)  consola y neutro: sí (como hoy); aplicación: solo si su suscriptor se la asigna (CC-145)
      origenesPermitidos(indice)          'https://<dominio>' de cada dominio activo, para CORS
*/
const TIPOS = new Set(['consola', 'aplicacion']);
const HOST_VALIDO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

function normalizarHost(valor) {
  let t = String(valor || '').trim().toLowerCase();
  if (!t) return '';
  t = t.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');      // esquema
  t = t.split(/[/?#]/)[0];                            // ruta
  t = t.replace(/^[^@]*@/, '');                       // usuario@
  t = t.replace(/:\d+$/, '').replace(/\.$/, '');      // puerto y punto final
  return t.length <= 253 && HOST_VALIDO.test(t) ? t : '';
}

function hostDeOrigen(origin, referer) {
  return normalizarHost(origin) || normalizarHost(referer);
}

const texto = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());
const activa = (v) => v === true || v === 1 || v === '1' || v === undefined || v === null;

function indexar(filas) {
  const indice = new Map();
  for (const f of filas || []) {
    const dominio = normalizarHost(f?.dominio);
    const tipo = String(f?.tipo || '').trim().toLowerCase();
    if (!dominio || !TIPOS.has(tipo) || !activa(f?.estado)) continue;
    if (tipo === 'aplicacion' && !texto(f.codigoAplicacion)) continue;
    indice.set(dominio, {
      tipo,
      dominio,
      codigoAplicacion: tipo === 'aplicacion' ? texto(f.codigoAplicacion) : null,
      codigoSuite: texto(f.codigoSuite),
      rutaPortal: texto(f.rutaPortal),
      rutaInicio: texto(f.rutaInicio),
      marca: { nombre: texto(f.nombreMarca), logo: texto(f.logoMarca) },
    });
  }
  return indice;
}

const NEUTRO = Object.freeze({
  tipo: 'neutro', dominio: null, codigoAplicacion: null, codigoSuite: null, rutaPortal: null, rutaInicio: null,
  marca: Object.freeze({ nombre: null, logo: null }),
});

function contextoDe(host, indice) {
  const h = normalizarHost(host);
  const fila = h && indice instanceof Map ? indice.get(h) : null;
  return fila ? { ...fila, marca: { ...fila.marca } } : { ...NEUTRO, dominio: h || null, marca: { ...NEUTRO.marca } };
}

function puedeEntrar(contexto, appsUsuario) {
  if (!contexto || contexto.tipo !== 'aplicacion') return true;
  const apps = new Set((appsUsuario || []).map((a) => String(a || '').trim().toLowerCase()));
  return apps.has(String(contexto.codigoAplicacion).toLowerCase());
}

function origenesPermitidos(indice) {
  return indice instanceof Map ? [...indice.keys()].map((d) => `https://${d}`) : [];
}

module.exports = { normalizarHost, hostDeOrigen, indexar, contextoDe, puedeEntrar, origenesPermitidos, NEUTRO };
