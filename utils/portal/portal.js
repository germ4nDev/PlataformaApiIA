/*
    Author: German Valencia
    Pattern: PORTTOS Util (núcleo puro, AD-16) - Portal público porttos.co (migración 025, 2026-10-30)
    Description: Arma lo que el portal muestra a partir de las filas de la BD, sin acceso a datos ni red:
      armarPagina({ pagina, secciones, elementos, cifras })   secciones activas en orden, con sus elementos; las cifras
                                                               {{tableros}} y {{puertos}} se calculan del maestro y, si no
                                                               llegan, el elemento se omite (datos honestos: nada inventado)
      armarPlanes({ planes, caracteristicas, comparativo, valores, aviso })
                                                               planes activos con sus características y la tabla comparativa;
                                                               si alguno es simulado, sale el aviso de valores de referencia
      configPublica(filas)                                     solo las claves que el portal puede ver
      planesActivos(config) · sinPlanes(pagina) · PLANES_VACIOS  planes de comercialización apagados (usuario, 2026-11-01:
                                                               la primera versión es para el Gobierno). Interruptor
                                                               TCL_PortalConfig.planesActivos ('1' = se ven); sin la clave, apagados
      limpiarTexto(texto, max) · revisarMensaje(m) · avisoCorreo(m)
*/

// 'app' = App móvil (CC-105): la app de tienda en detalle
const PAGINAS = Object.freeze(['inicio', 'solucion', 'app', 'perfiles', 'puertos', 'gobierno', 'planes', 'mision', 'contacto']);
const IDIOMAS = Object.freeze(['es', 'en']);

/** Motivos de Contáctenos. No hay registro abierto: el acceso se pide aquí (decisión del usuario, 2026-10-30). */
const MOTIVOS = Object.freeze({
  DEMOSTRACION: 'Solicitar una demostración',
  ACCESO: 'Solicitar acceso con un plan',
  INFORMACION: 'Información general',
  SOPORTE: 'Soporte a un usuario existente',
});

/** Claves de TCL_PortalConfig que el portal puede leer (el resto es interno). urlAndroid y urlIos: tiendas de la app (CC-103). */
const CONFIG_PUBLICA = Object.freeze(['correoContacto', 'rutaIngreso', 'avisoPrecios', 'tiempoRespuesta', 'textoPie', 'urlAndroid', 'urlIos',
  'planesActivos']);   // planesActivos (CC-106): '1' muestra la página Planes y sus enlaces; otro valor o sin la clave, ocultos

const activo = (f) => f && f.activo !== false && f.activo !== 0;
const porOrden = (a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || (Number(a.id) || 0) - (Number(b.id) || 0);
const texto = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v));
const TOKEN = /^\{\{\s*([a-z]+)\s*\}\}$/i;

function resolverValor(valor, cifras) {
  const m = typeof valor === 'string' ? valor.match(TOKEN) : null;
  if (!m) return { valor: texto(valor), ok: true };
  const n = cifras ? cifras[m[1]] : undefined;
  return Number.isFinite(Number(n)) && n !== null ? { valor: String(n), ok: true } : { valor: null, ok: false };
}

function armarPagina({ pagina, secciones = [], elementos = [], cifras = {} }) {
  const porSeccion = new Map();
  for (const e of (elementos || []).filter(activo)) {
    const lista = porSeccion.get(e.idSeccion) || [];
    lista.push(e);
    porSeccion.set(e.idSeccion, lista);
  }
  return {
    pagina,
    secciones: (secciones || []).filter(activo).sort(porOrden).map((s) => ({
      codigo: s.codigo,
      tipo: s.tipo,
      antetitulo: texto(s.antetitulo),
      titulo: texto(s.titulo),
      subtitulo: texto(s.subtitulo),
      cuerpo: texto(s.cuerpo),
      imagen: texto(s.imagen),
      enlace: texto(s.enlaceUrl) ? { texto: texto(s.enlaceTexto) || texto(s.enlaceUrl), url: s.enlaceUrl } : null,
      elementos: (porSeccion.get(s.id) || []).sort(porOrden).map((e) => {
        const r = resolverValor(e.valor, cifras);
        return r.ok ? {
          titulo: texto(e.titulo), texto: texto(e.texto), detalle: texto(e.detalle), icono: texto(e.icono), color: texto(e.color),
          valor: r.valor, url: texto(e.enlaceUrl),
        } : null;
      }).filter(Boolean),
    })),
  };
}

const numero = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const bool = (v) => v === true || v === 1 || v === '1';

function armarPlanes({ planes = [], caracteristicas = [], comparativo = [], valores = [], aviso = null }) {
  const lista = (planes || []).filter(activo).sort(porOrden).map((p) => ({
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: texto(p.descripcion),
    precioMensual: numero(p.precioMensual),
    precioAnual: numero(p.precioAnual),
    moneda: p.moneda || 'COP',
    etiquetaPrecio: texto(p.etiquetaPrecio),
    destacado: bool(p.destacado),
    simulado: bool(p.simulado),
    caracteristicas: (caracteristicas || []).filter((c) => activo(c) && c.codigoPlan === p.codigo).sort(porOrden).map((c) => c.texto),
  }));
  const codigos = lista.map((p) => p.codigo);
  const filas = (comparativo || []).filter(activo).sort(porOrden).map((f) => {
    const vals = {};
    for (const v of valores || []) if (v.idFila === f.id && codigos.includes(v.codigoPlan)) vals[v.codigoPlan] = v.valor;
    return { concepto: f.concepto, valores: vals };
  });
  const simulado = lista.some((p) => p.simulado);
  return { simulado, aviso: simulado ? texto(aviso) : null, planes: lista, comparativo: { columnas: codigos, filas } };
}

/** Planes de comercialización visibles solo con planesActivos = '1' (o true/si). Sin la clave quedan apagados (CC-106). */
function planesActivos(config) {
  const v = String((config && config.planesActivos) ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'si' || v === 'sí';
}

/** Respuesta de planes con el interruptor apagado: nada que pintar (el contenido sigue en la BD para cuando se active). */
const PLANES_VACIOS = Object.freeze({ simulado: false, aviso: null, planes: [], comparativo: { columnas: [], filas: [] }, inactivo: true });

const aPlanes = (url) => /^\/planes(?:[/?#]|$)/i.test(String(url || '').trim());

/**
 * Página sin enlaces a /planes (CC-106): el enlace de una sección se quita; un elemento que solo lleva a /planes (botón «Ver
 * planes») sale; en «perfiles» la tarjeta se queda y pierde el enlace (su plan recomendado no se nombra).
 */
function sinPlanes(pagina) {
  if (!pagina || !Array.isArray(pagina.secciones)) return pagina;
  return {
    ...pagina,
    secciones: pagina.secciones.map((s) => ({
      ...s,
      enlace: s.enlace && aPlanes(s.enlace.url) ? null : s.enlace,
      elementos: (s.elementos || []).flatMap((e) => {
        if (!aPlanes(e.url)) return [e];
        return s.tipo === 'perfiles' ? [{ ...e, url: null, valor: null }] : [];
      }),
    })),
  };
}

function configPublica(filas = []) {
  const salida = {};
  for (const f of filas || []) if (CONFIG_PUBLICA.includes(f.clave)) salida[f.clave] = texto(f.valor);
  return salida;
}

/** Quita caracteres de control (deja saltos de línea), recorta y limita el largo. */
function limpiarTexto(valor, max = 4000) {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim();
  return s ? s.slice(0, max) : null;
}

/** Spam evidente: el campo trampa (sitioWeb, invisible para personas) viene lleno o el mensaje trae más de 3 enlaces. */
function revisarMensaje(m = {}) {
  if (texto(m.sitioWeb)) return { spam: true, razon: 'campo trampa' };
  const enlaces = (String(m.mensaje || '').match(/https?:\/\//gi) || []).length;
  if (enlaces > 3) return { spam: true, razon: 'demasiados enlaces' };
  return { spam: false, razon: null };
}

/** Correo de aviso al equipo: texto plano (nada de HTML con lo que escribió el visitante). */
function avisoCorreo(m = {}) {
  const motivo = MOTIVOS[m.motivo] || m.motivo || 'Mensaje';
  const lineas = [
    `Motivo: ${motivo}`,
    m.codigoPlan ? `Plan de interés: ${m.codigoPlan}` : null,
    `Nombre: ${m.nombre}`,
    m.empresa ? `Empresa: ${m.empresa}` : null,
    `Correo: ${m.correo}`,
    m.telefono ? `Teléfono: ${m.telefono}` : null,
    m.puerto ? `Puerto: ${m.puerto}` : null,
    '',
    m.mensaje,
  ].filter((l) => l !== null);
  return { asunto: `[Portal Porttos] ${motivo} · ${m.nombre}`.slice(0, 180), texto: lineas.join('\n') };
}

module.exports = {
  PAGINAS, IDIOMAS, MOTIVOS, CONFIG_PUBLICA,
  armarPagina, armarPlanes, configPublica, limpiarTexto, revisarMensaje, avisoCorreo,
  planesActivos, sinPlanes, PLANES_VACIOS,
};
