/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - «¿Por qué?» de un KPI (la IA en las pestañas, fase 2; CC-282)
    Description: Sin base de datos ni red. Explica el valor de un KPI con su serie, su tendencia, sus señales y los KPI de las otras
      pestañas que lo pueden mover. Las relaciones entre KPI (RELACIONES) las define Porttos, no la IA: la IA solo las usa para explicar.
      - WIDGET_KPI: código del widget de la tarjeta (PTT_*_KPI_*) → código del catálogo de la foto (null = sin «¿Por qué?»).
      - relacionadosDe(codigo): KPI que lo pueden explicar (otras pestañas primero) con el porqué de la relación.
      - armarContextoPorQue({ puerto, codigo, foto, tendencias }): el KPI, sus relacionados con valor y tendencia, sus señales, las
        cifras permitidas y el índice de ids (kpi.<codigo>).
      - PROMPT_POR_QUE + armarSolicitudPorQue(): herramienta emitir_explicacion { resumen, causas[{kpi, porque}], vigilar[] }.
      - verificarExplicacion(): quita causas con KPI que no están en el contexto y textos con cifras que no están en los datos.
      - explicacionAutomatica(): el mismo formato sin modelo (umbral, tendencia y relacionados que empeoran).
*/
const { POR_CODIGO, idEvidenciaKpi } = require('./catalogo-kpi');
const { numerosEn } = require('./prevencion');

/** Widget de la tarjeta → KPI del catálogo (solo los que existen en la foto). */
const WIDGET_KPI = Object.freeze({
  PTT_MAE_KPI_FONDEO: 'maritimo.naves_fondeadas', PTT_MAE_KPI_MUELLE: 'maritimo.ocupacion_muelles_pct',
  PTT_BOD_KPI_OCUPACION: 'bodegas.ocupacion_pct', PTT_BOD_KPI_INVENTARIO: 'bodegas.inventario_t', PTT_BOD_KPI_DESPACHOS: 'bodegas.flujo_24h_t',
  PTT_BOD_KPI_ALERTAS: 'bodegas.en_alerta',
  PTT_CONT_KPI_CARGADOS: 'contenedores.cargados_pendientes', PTT_CONT_KPI_VACIOS: 'contenedores.vacios_devolver',
  PTT_CONT_KPI_REEFER: 'contenedores.reefer_activos', PTT_CONT_KPI_FREETIME: 'contenedores.free_time_vencido',
  PTT_GRA_KPI_AGRICOLA: 'granel.agricola_t', PTT_GRA_KPI_MINERAL: 'granel.mineral_t', PTT_GRA_KPI_LIQUIDO: 'granel.liquido_t',
  PTT_SUE_KPI_BREAKBULK: 'suelta.breakbulk_t', PTT_SUE_KPI_VEH_IMPORT: 'suelta.vehiculos_import', PTT_SUE_KPI_VEH_EXPORT: 'suelta.vehiculos_export',
  PTT_CAP_KPI_CRITICOS: 'capacidad.nodos_criticos',
  PTT_GNL_KPI_PRESION: 'gnl.presion_psi', PTT_GNL_KPI_ALERTAS: 'gnl.alarmas_24h',
});

/** Relaciones entre pestañas: el KPI de la izquierda lo pueden mover los de la lista (con el porqué). */
const RELACIONES = Object.freeze({
  'maritimo.naves_fondeadas': [['maritimo.ocupacion_muelles_pct', 'si los muelles están llenos, las naves esperan en fondeo'], ['maritimo.naves_atracadas', 'naves que no zarpan ocupan los muelles']],
  'maritimo.espera_fondeo_prom_min': [['maritimo.ocupacion_muelles_pct', 'sin muelle libre la espera en fondeo crece'], ['maritimo.naves_fondeadas', 'más naves en fondeo, más espera']],
  'maritimo.ocupacion_muelles_pct': [['maritimo.naves_atracadas', 'cada nave atracada ocupa un muelle'], ['maritimo.naves_fondeadas', 'la cola de fondeo presiona los muelles']],
  'contenedores.cargados_pendientes': [['maritimo.naves_atracadas', 'el descargue de buques llena el patio de llenos'], ['gate.retrasadas', 'citas de retiro retrasadas dejan contenedores en patio'], ['contenedores.free_time_vencido', 'contenedores que no se retiran a tiempo']],
  'contenedores.free_time_vencido': [['contenedores.cargados_pendientes', 'contenedores llenos que siguen en patio'], ['gate.retrasadas', 'retiros que no llegan a su cita']],
  'gate.en_cola': [['gate.retrasadas', 'citas retrasadas se acumulan en la cola'], ['contenedores.cargados_pendientes', 'más contenedores por retirar, más camiones'], ['viales.cierres', 'cierres en el corredor desordenan las llegadas'], ['viales.accidentes', 'accidentes retrasan los camiones']],
  'gate.espera_prom_min': [['gate.en_cola', 'más camiones en cola, más espera'], ['gate.retenidos', 'camiones retenidos en validación frenan el paso'], ['viales.cierres', 'llegadas en bloque después de un cierre']],
  'gate.retrasadas': [['viales.cierres', 'los cierres viales retrasan las citas'], ['viales.accidentes', 'los accidentes retrasan las citas'], ['gate.en_cola', 'la cola hace perder la ventana de la cita']],
  'bodegas.ocupacion_pct': [['granel.agricola_t', 'el descargue de granel agrícola entra a bodega'], ['suelta.breakbulk_t', 'la carga suelta ocupa bodega'], ['bodegas.flujo_24h_t', 'si el despacho baja, la bodega se llena']],
  'bodegas.en_alerta': [['bodegas.ocupacion_pct', 'la ocupación alta dispara las alertas'], ['granel.agricola_t', 'el granel que entra a bodega']],
  'capacidad.nodos_criticos': [['bodegas.ocupacion_pct', 'bodegas llenas'], ['contenedores.cargados_pendientes', 'patios de contenedores llenos'], ['gate.en_cola', 'la cola del gate frena las salidas']],
  'capacidad.ocupacion_max_pct': [['bodegas.ocupacion_pct', 'bodegas llenas'], ['contenedores.cargados_pendientes', 'patios llenos']],
  'capacidad.espera_max_min': [['gate.espera_prom_min', 'la espera del gate'], ['gate.en_cola', 'la cola de camiones']],
  'granel.agricola_t': [['maritimo.naves_atracadas', 'el granel se mueve con buques atracados']],
  'granel.mineral_t': [['maritimo.naves_atracadas', 'el granel se mueve con buques atracados']],
  'suelta.breakbulk_t': [['maritimo.naves_atracadas', 'la carga suelta se mueve con buques atracados']],
  'gnl.alarmas_24h': [['gnl.presion_psi', 'la presión fuera de rango dispara alarmas']],
  'gnl.presion_psi': [['gnl.volumen_hora_m3', 'el caudal de la última hora mueve la presión']],
});

const modulo = (codigo) => String(codigo).split('.')[0];

/** KPI que pueden explicar al dado: los de RELACIONES (otras pestañas primero), luego los de su mismo módulo. */
function relacionadosDe(codigo, max = 6) {
  const propios = (RELACIONES[codigo] || []).map(([k, porque]) => ({ codigo: k, porque }));
  const mismos = [...POR_CODIGO.keys()].filter((k) => k !== codigo && modulo(k) === modulo(codigo) && !propios.some((p) => p.codigo === k))
    .map((k) => ({ codigo: k, porque: 'mismo tablero' }));
  const orden = (r) => (modulo(r.codigo) === modulo(codigo) ? 1 : 0);
  return [...propios.sort((a, b) => orden(a) - orden(b)), ...mismos].slice(0, max);
}

const kpisDeFoto = (foto) => new Map(Object.values(foto?.modulos || {}).flatMap((m) => m.kpis || []).map((k) => [String(k.id).replace(/^kpi\./, ''), k]));

/** Lectura de tendencias de un KPI: { '24h': {...}, '7d': {...} } (solo con datos). */
function tendenciaDe(tendencias, codigo) {
  const t = (tendencias?.kpis || []).find((k) => k.codigo === codigo);
  if (!t) return null;
  const v = Object.fromEntries(Object.entries(t.ventanas || {}).filter(([, x]) => x && x.direccion !== 'sin_datos')
    .map(([w, x]) => [w, { actual: x.actual, referencia: x.referencia, cambioPct: x.cambioPct, direccion: x.direccion, efecto: x.efecto, lectura: x.lectura }]));
  return Object.keys(v).length ? v : null;
}

/**
 * @returns {{ puerto, kpi, relacionados, senales, simulado, cifras:Set<number>, indice:Set<string> } | null}  null si el KPI no está en la foto
 */
function armarContextoPorQue({ puerto, codigo, foto, tendencias }) {
  const kpis = kpisDeFoto(foto);
  const k = kpis.get(codigo);
  if (!k) return null;
  const cifras = new Set();
  const anotar = (...ns) => ns.flat().forEach((n) => { const x = Number(n); if (n !== null && n !== undefined && Number.isFinite(x)) { cifras.add(x); cifras.add(Math.round(x)); cifras.add(Math.round(x * 10) / 10); } });
  const ficha = (c, kk) => {
    const t = tendenciaDe(tendencias, c);
    anotar(kk.valor, kk.serie || [], kk.umbrales?.atencion, kk.umbrales?.critico);
    Object.values(t || {}).forEach((x) => anotar(x.actual, x.referencia, x.cambioPct, Math.abs(Number(x.cambioPct))));
    return { id: idEvidenciaKpi(c), titulo: kk.titulo, unidad: kk.unidad, valor: kk.valor, umbrales: kk.umbrales || null,
      ultimos: (kk.serie || []).slice(-8), tendencia: t, simulado: !!kk.simulado };
  };
  const kpi = ficha(codigo, k);
  const relacionados = relacionadosDe(codigo).filter((r) => kpis.has(r.codigo)).map((r) => ({ ...ficha(r.codigo, kpis.get(r.codigo)), relacion: r.porque }));
  const senales = (foto.senales || []).filter((s) => String(s.id).includes(codigo) || relacionados.some((r) => String(s.id).includes(r.id.replace(/^kpi\./, ''))))
    .map((s) => ({ id: s.id, tipo: s.tipo, severidad: s.severidad, titulo: s.titulo }));
  anotar(7, 15, 24, 30);   // ventanas que la IA puede nombrar (15 min, 24 h, 7 y 30 días)
  return { puerto, kpi, relacionados, senales, simulado: kpi.simulado || relacionados.some((r) => r.simulado), cifras, indice: new Set([kpi.id, ...relacionados.map((r) => r.id)]) };
}

const SISTEMA_POR_QUE_V1 = `Eres el analista de Porttos, la torre de control logística del puerto de {PUERTO}. El usuario pidió «¿Por qué?» sobre el
indicador «{KPI}». Porttos te da el valor actual, sus últimos valores (cada 15 min), su tendencia, sus señales y los indicadores de otras
pestañas que lo pueden mover, con el porqué de cada relación (las relaciones las define Porttos).

Explica en español claro, para el jefe de turno:
- «resumen»: una o dos frases: si el valor es normal o preocupante (frente a sus umbrales y su tendencia) y la causa más probable.
- «causas»: hasta 3, de la más a la menos probable, cada una con el id del indicador relacionado (kpi.*) y un porqué corto que use sus
  cifras. Solo indicadores que estén en los datos; si ninguno explica el valor, deja la lista vacía y dilo en el resumen.
- «vigilar»: hasta 2 cosas para mirar en las próximas horas.

Reglas: usa SOLO cifras de los datos, con su unidad; no inventes causas fuera de los datos; si hay datos simulados, dilo. Responde con
emitir_explicacion.`;

const HERRAMIENTA_POR_QUE = Object.freeze({
  name: 'emitir_explicacion',
  description: 'Explicación del valor de un indicador con sus causas probables (indicadores relacionados) y qué vigilar.',
  input_schema: {
    type: 'object',
    properties: {
      resumen: { type: 'string', description: 'Una o dos frases (máx. 400 caracteres).' },
      causas: { type: 'array', items: { type: 'object', properties: { kpi: { type: 'string', description: 'kpi.<codigo> de los datos' }, porque: { type: 'string', description: 'Máx. 300 caracteres.' } }, required: ['kpi', 'porque'] } },
      vigilar: { type: 'array', items: { type: 'string' }, description: 'Hasta 2, máx. 200 caracteres.' },
    },
    required: ['resumen', 'causas', 'vigilar'],
  },
});

const PROMPT_POR_QUE = Object.freeze({
  codigoTarea: 'por_que', version: 1, idPrompt: null, origen: 'incorporado', temperatura: 0.2, maxTokens: 900, sistema: SISTEMA_POR_QUE_V1, herramienta: HERRAMIENTA_POR_QUE,
});

const hechosDe = ({ cifras, indice, ...hechos }) => hechos;

function armarSolicitudPorQue(contexto, prompt = PROMPT_POR_QUE) {
  return {
    sistema: [{ texto: prompt.sistema.replace(/\{PUERTO\}/g, contexto.puerto).replace(/\{KPI\}/g, contexto.kpi.titulo), cache: false }],
    mensajes: [{ role: 'user', content: `Datos de Porttos:\n\n${JSON.stringify(hechosDe(contexto))}\n\nResponde con emitir_explicacion.` }],
    herramienta: prompt.herramienta || HERRAMIENTA_POR_QUE,
  };
}

const cifrasHonestas = (texto, c) => numerosEn(texto).every((n) => c.cifras.has(n) || c.cifras.has(Math.round(n)) || c.cifras.has(Math.round(n * 10) / 10));

function verificarExplicacion(salida, contexto) {
  const quitadas = [];
  const vistos = new Set();
  const causas = (salida.causas || []).filter((x) => {
    if (!contexto.indice.has(x.kpi) || x.kpi === contexto.kpi.id) { quitadas.push(`kpi inexistente ${x.kpi}`); return false; }
    if (vistos.has(x.kpi)) { quitadas.push(`kpi repetido ${x.kpi}`); return false; }
    vistos.add(x.kpi);
    if (!cifrasHonestas(x.porque, contexto)) { quitadas.push(`cifra no verificable en ${x.kpi}`); return false; }
    return true;
  }).slice(0, 3);
  const vigilar = (salida.vigilar || []).filter((v) => { const ok = cifrasHonestas(v, contexto); if (!ok) quitadas.push('vigilar con cifra no verificable'); return ok; }).slice(0, 2);
  let resumen = salida.resumen;
  if (!cifrasHonestas(resumen, contexto)) { quitadas.push('resumen con cifra no verificable'); resumen = explicacionAutomatica(contexto).resumen; }
  return { salida: { resumen, causas, vigilar }, quitadas };
}

const fmt = (v, u) => (v === null || v === undefined ? 'sin dato' : `${v}${u ? (u === '%' ? ' %' : ` ${u}`) : ''}`);

/** Sin modelo: estado frente al umbral, tendencia de 24 h y los relacionados que empeoran. */
function explicacionAutomatica(contexto) {
  const { kpi, relacionados } = contexto;
  const u = kpi.umbrales;
  const alto = u?.sentido !== 'bajo';
  const estado = u && kpi.valor !== null
    ? ((alto ? kpi.valor >= u.critico : kpi.valor <= u.critico) ? 'en nivel crítico' : (alto ? kpi.valor >= u.atencion : kpi.valor <= u.atencion) ? 'en atención' : 'en rango normal')
    : null;
  const t = kpi.tendencia ? (kpi.tendencia['24h'] || Object.values(kpi.tendencia)[0]) : null;
  const partes = [`${kpi.titulo}: ${fmt(kpi.valor, kpi.unidad)}${estado ? `, ${estado}` : ''}.`];
  if (t?.lectura) partes.push(t.lectura);
  const empeoran = relacionados.filter((r) => Object.values(r.tendencia || {}).some((x) => x.efecto === 'empeora'));
  const causas = (empeoran.length ? empeoran : relacionados.filter((r) => r.valor !== null)).slice(0, 3)
    .map((r) => ({ kpi: r.id, porque: `${fmt(r.valor, r.unidad)}: ${r.relacion}.` }));   // el título lo pone la pantalla
  if (!causas.length) partes.push('Ningún indicador relacionado tiene datos para explicarlo.');
  return { resumen: partes.join(' '), causas, vigilar: [] };
}

module.exports = {
  WIDGET_KPI, RELACIONES, relacionadosDe, armarContextoPorQue, PROMPT_POR_QUE, HERRAMIENTA_POR_QUE, armarSolicitudPorQue,
  verificarExplicacion, explicacionAutomatica, hechosDe,
};
