/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Noticias y actualidad (TLC_NOTICIAS)
    Description: Sin base de datos ni red.
      - TEMAS: búsquedas por categoría (las mismas de la maqueta del tablero).
      - prepararNoticia(): normaliza un titular de Google News RSS o de GNews, le da id (hash del título sin el medio,
        así el mismo titular de dos proveedores no se repite), detecta el puerto que menciona y su relevancia.
      - armarNoticias(): tablero de la pestaña (KPIs, feed, corredores, clima, fuentes).
*/
const crypto = require('crypto');
const C = require('./tablero-comun');

const TEMAS = Object.freeze([
  { categoria: 'PUERTOS', nombre: 'Puertos', consulta: 'puerto Buenaventura OR "sociedad portuaria" OR Supertransporte OR SPRBUN OR "terminal portuario" Colombia' },
  { categoria: 'TRANSPORTE', nombre: 'Transporte', consulta: '"transporte de carga" Colombia OR Mintransporte OR RNDC OR flete camiones OR "tarifa de transporte" Colombia' },
  { categoria: 'CARRETERAS', nombre: 'Carreteras', consulta: 'vías Colombia OR INVIAS OR ANI concesiones OR "cierre vial" OR "vía al mar" Buenaventura OR derrumbe carretera Colombia' },
  { categoria: 'COMERCIO_EXTERIOR', nombre: 'Comercio exterior', consulta: 'naviera Colombia OR "comercio exterior" Colombia OR importaciones exportaciones puerto OR contenedores Colombia' },
  { categoria: 'GREMIOS', nombre: 'Gremios', consulta: 'Colfecar OR Analdex OR ANDI OR Fenalco OR Fedetranscarga OR Asecarga OR "Cámara Colombiana de Infraestructura"' },
]);
const NOMBRE_CATEGORIA = Object.fromEntries(TEMAS.map((t) => [t.categoria, t.nombre]));
const RETENCION_DIAS = 60;

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const limpiarHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Google News pone " - Medio" al final del título: se separa. */
function separarMedio(titulo, medio) {
  const t = limpiarHtml(titulo);
  const m = t.match(/^(.*\S)\s+-\s+([^-]{2,80})$/);
  if (m) return { titulo: m[1], medio: medio || m[2] };
  return { titulo: t, medio: medio || null };
}

const claveTitulo = (titulo) => sinTildes(titulo).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const hashTitulo = (titulo) => crypto.createHash('sha1').update(claveTitulo(titulo)).digest('hex');

/**
 * @param {{titulo, url, fecha, medio?, resumen?}} item  ya leído por el adaptador
 * @param {{categoria, proveedor, puertos?: Array<{clave, nombres:string[]}>}} ctx
 * @returns noticia lista para TCL_Noticias, o null si no sirve (sin título, url o fecha)
 */
function prepararNoticia(item, { categoria, proveedor, puertos = [] }, ahora = new Date()) {
  if (!item?.titulo || !item?.url) return null;
  const ms = Date.parse(item.fecha);
  if (!Number.isFinite(ms) || ms > ahora.getTime() + 3600000) return null;
  const { titulo, medio } = separarMedio(item.titulo, item.medio);
  if (titulo.length < 15) return null;
  const texto = sinTildes(`${titulo} ${item.resumen || ''}`).toUpperCase();
  const puerto = puertos.find((p) => p.nombres.some((n) => texto.includes(sinTildes(n).toUpperCase())));
  return {
    id_hash: hashTitulo(titulo),
    titulo: titulo.slice(0, 400),
    resumen: item.resumen ? limpiarHtml(item.resumen).slice(0, 1000) : null,
    url: String(item.url).slice(0, 1000),
    medio: medio ? String(medio).slice(0, 150) : null,
    proveedor,
    categoria,
    id_puerto: puerto ? puerto.clave : null,
    relevancia: (categoria === 'PUERTOS' ? 2 : 1) + (puerto ? 2 : 0),
    fecha_publicacion: new Date(ms).toISOString(),
    fecha_ingesta: ahora.toISOString(),
  };
}

/** Quita repetidos (mismo hash) dejando el de mayor relevancia. */
function sinRepetidos(noticias) {
  const m = new Map();
  for (const n of noticias.filter(Boolean)) {
    const previa = m.get(n.id_hash);
    if (!previa || n.relevancia > previa.relevancia) m.set(n.id_hash, n);
  }
  return [...m.values()];
}

/** Estado de un corredor según el peor evento vial activo. */
function estadoCorredor(eventos) {
  const textos = eventos.map((e) => sinTildes(`${e.tipoEvento || ''} ${e.nivelSeveridad || ''}`).toUpperCase());
  if (textos.some((t) => /CIERRE TOTAL|CERRAD/.test(t))) return { estado: 'CERRADO', semaforo: 'rojo' };
  if (textos.some((t) => /CIERRE|ACCIDENTE|ALTA|CRITIC/.test(t))) return { estado: 'RESTRINGIDO', semaforo: 'rojo' };
  if (textos.length) return { estado: 'PRECAUCIÓN', semaforo: 'amarillo' };
  return { estado: 'HABILITADO', semaforo: 'verde' };
}

const textoClima = (codigo) => {
  const c = Number(codigo);
  if (c === 0) return 'Despejado';
  if (c <= 3) return 'Parcialmente nublado';
  if (c <= 48) return 'Niebla';
  if (c <= 67) return 'Lluvia';
  if (c <= 77) return 'Nieve';
  if (c <= 82) return 'Aguaceros';
  return 'Tormenta';
};

/**
 * @param {{ noticias, trm: Array<{fecha, valor}>, eventos, alertasClima, clima: Array<{puerto, temperatura, vientoNudos, codigoTiempo}>, fuentes, puerto }} datos
 */
function armarNoticias({ noticias = [], trm = [], eventos = [], alertasClima = [], clima = [], fuentes = [], puerto = null }, ahora = new Date()) {
  const ahoraMs = ahora.getTime();
  const hoyMs = C.inicioDiaColombia(ahoraMs);
  const ordenadas = [...noticias].sort((a, b) => Date.parse(b.fecha_publicacion) - Date.parse(a.fecha_publicacion));
  const deHoy = ordenadas.filter((n) => Date.parse(n.fecha_publicacion) >= hoyMs);
  const trmOrden = [...trm].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  const [trmHoy, trmAntes] = trmOrden;
  const variacion = trmHoy && trmAntes ? C.redondear(((trmHoy.valor - trmAntes.valor) / trmAntes.valor) * 100, 2) : null;

  // Corredores: eventos viales activos agrupados por corredor
  const porCorredor = new Map();
  for (const e of eventos) {
    const k = e.corredorVial || e.sector || 'Sin corredor';
    if (!porCorredor.has(k)) porCorredor.set(k, []);
    porCorredor.get(k).push(e);
  }
  const corredores = [...porCorredor.entries()].map(([nombre, evs]) => ({
    corredor: nombre, ...estadoCorredor(evs), eventos: evs.length,
    detalle: evs.slice(0, 3).map((e) => [e.tipoEvento, e.sector].filter(Boolean).join(' · ')).join(' | '),
  })).sort((a, b) => ({ rojo: 0, amarillo: 1, verde: 2 }[a.semaforo] - { rojo: 0, amarillo: 1, verde: 2 }[b.semaforo]) || b.eventos - a.eventos);

  const severas = alertasClima.filter((a) => Number(a.nivelSeveridad) >= 3).length;

  return {
    puerto,
    generadoEn: ahora.toISOString(),
    kpis: {
      PTT_NOT_KPI_TRM: C.kpi({
        // Texto con '$' para que la tarjeta no la abrevie a "4K"; el valor completo va debajo
        titulo: 'TRM HOY', valor: trmHoy ? `$${Math.round(Number(trmHoy.valor)).toLocaleString('es-CO')}` : 0, unidad: 'COP', colorBorde: 'borde-green', icono: 'feather icon-dollar-sign',
        valorCompleto: trmHoy ? `${Number(trmHoy.valor).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} COP por dólar` : null,
        subtitulo: trmHoy ? `${variacion === null ? 'Banco de la República' : `${variacion > 0 ? '▲' : variacion < 0 ? '▼' : '='} ${Math.abs(variacion)} % vs. anterior`}` : 'Sin dato de TRM',
      }),
      PTT_NOT_KPI_NOTICIAS: C.kpi({
        titulo: 'NOTICIAS HOY', valor: deHoy.length, colorBorde: 'borde-blue', icono: 'feather icon-file-text',
        subtitulo: deHoy.length ? `${deHoy.filter((n) => n.id_puerto === puerto).length} del puerto` : 'Sin noticias nuevas hoy',
      }),
      PTT_NOT_KPI_VIAS: C.kpi({
        titulo: 'RESTRICCIONES VIALES', valor: eventos.length, colorBorde: eventos.length ? 'borde-naranja' : 'borde-green', icono: 'feather icon-alert-octagon',
        subtitulo: corredores.length ? `${corredores.filter((c) => c.semaforo === 'rojo').length} corredores con cierre o accidente` : 'Corredores sin eventos',
      }),
      PTT_NOT_KPI_CLIMA: C.kpi({
        titulo: 'ALERTAS CLIMÁTICAS', valor: alertasClima.length, colorBorde: severas ? 'borde-rojo' : alertasClima.length ? 'borde-amarillo' : 'borde-green', icono: 'feather icon-cloud-rain',
        subtitulo: alertasClima.length ? `${severas} de severidad alta` : 'Sin alertas activas',
      }),
    },
    noticias: ordenadas.slice(0, 60).map((n) => ({
      id: n.id_hash, titulo: n.titulo, resumen: n.resumen, url: n.url, medio: n.medio, proveedor: n.proveedor,
      categoria: n.categoria, categoriaNombre: NOMBRE_CATEGORIA[n.categoria] || n.categoria,
      delPuerto: !!puerto && n.id_puerto === puerto, fecha: n.fecha_publicacion,
    })),
    categorias: TEMAS.map((t) => ({ codigo: t.categoria, nombre: t.nombre, noticias: ordenadas.filter((n) => n.categoria === t.categoria).length })),
    corredores,
    clima: clima.map((c) => ({ ...c, condicion: textoClima(c.codigoTiempo) })),
    fuentes: ['OFICIAL', 'TRANSPORTE', 'COMERCIO_INDUSTRIA', 'GOBIERNO_MEDIOS'].map((g) => ({
      grupo: g, nombre: { OFICIAL: 'Fuentes oficiales', TRANSPORTE: 'Gremios de transporte', COMERCIO_INDUSTRIA: 'Comercio e industria', GOBIERNO_MEDIOS: 'Gobierno y medios' }[g],
      enlaces: fuentes.filter((f) => f.grupo === g).sort((a, b) => a.orden - b.orden).map((f) => ({ nombre: f.nombre, descripcion: f.descripcion, url: f.url })),
    })).filter((g) => g.enlaces.length),
    trm: trmHoy ? { valor: Number(trmHoy.valor), fecha: trmHoy.fecha, variacionPct: variacion } : null,
  };
}

module.exports = { TEMAS, RETENCION_DIAS, separarMedio, hashTitulo, prepararNoticia, sinRepetidos, estadoCorredor, armarNoticias };
