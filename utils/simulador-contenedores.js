/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Simulador de inventario de contenedores en patio (OT-009, 2026-10-29)
    Description: Sin base de datos ni red; lo usan simulador-operacion.service.js y las pruebas.
      Mientras un puerto no tenga inventario real en TCL_InventarioContenedores, genera los contenedores que están en patio
      a la hora dada:
        - llegadas por día de los últimos 20 días, reproducibles (semilla puerto + día); cada contenedor tiene su hora de
          ingreso, su estadía y su free time, así que el inventario sale del reloj y no hace falta guardar estado;
        - escala por los muelles del puerto (nada fijo a un puerto);
        - llenos con free time de 5, 7 o 10 días y una parte que se queda más (free time vencido); vacíos por devolver;
          reefer con temperatura de consigna; siglas ISO 6346 con el prefijo de la naviera.
      Todo va con fuente SIMULADOR y simulado = 1 (lo pone el servicio).
*/
const { rngDe } = require('./simulador-gate');

const HORA = 3600000;
const DIA = 24 * HORA;
const DIAS_HISTORIA = 20;
const NAVIERAS = Object.freeze([['MSC', 'MSCU'], ['MAERSK', 'MAEU'], ['CMA CGM', 'CMAU'], ['HAPAG-LLOYD', 'HLXU'], ['ONE', 'ONEU'], ['EVERGREEN', 'EGLV'], ['ZIM', 'ZIMU'], ['COSCO', 'CSNU']]);
const PARAMETROS = Object.freeze({
  llenosPorMuelle: 28, vaciosPorMuelle: 10, topeLlenos: 520, topeVacios: 200,
  estadiaLlenos: [1, 9], estadiaVacios: [2, 14], freeTime: [5, 7, 10], probQuedarse: 0.12, probReefer: 0.12,
});

const entre = (rng, a, b) => a + (b - a) * rng();
const entero = (rng, a, b) => Math.floor(entre(rng, a, b + 1));
const elegir = (rng, lista) => lista[Math.floor(rng() * lista.length) % lista.length];
const inicioDia = (ms) => ms - (((ms % DIA) + DIA) % DIA);

/** Contenedores que llegaron un día (con su estadía), reproducibles por puerto + día. */
function llegadasDelDia(clave, muelles, diaMs) {
  const rng = rngDe(`${clave}|contenedores|${new Date(diaMs).toISOString().slice(0, 10)}`);
  const llenos = Math.min(PARAMETROS.topeLlenos, PARAMETROS.llenosPorMuelle * muelles);
  const vacios = Math.min(PARAMETROS.topeVacios, PARAMETROS.vaciosPorMuelle * muelles);
  // llegadas diarias ≈ inventario objetivo / estadía media
  const nLlenos = Math.round(llenos / 5.5 * entre(rng, 0.8, 1.2));
  const nVacios = Math.round(vacios / 8 * entre(rng, 0.8, 1.2));
  const lista = [];
  for (let i = 0; i < nLlenos + nVacios; i++) {
    const vacio = i >= nLlenos;
    const [naviera, prefijo] = elegir(rng, NAVIERAS);
    const reefer = !vacio && rng() < PARAMETROS.probReefer;
    const iso = reefer ? elegir(rng, ['22R1', '45R1', '45R1']) : elegir(rng, ['22G1', '42G1', '45G1', '45G1']);
    const ingreso = diaMs + Math.floor(entre(rng, 0, 24) * HORA);
    const ft = elegir(rng, PARAMETROS.freeTime);
    let estadia = vacio ? entre(rng, ...PARAMETROS.estadiaVacios) : entre(rng, ...PARAMETROS.estadiaLlenos);
    if (!vacio && rng() < PARAMETROS.probQuedarse) estadia = ft + entre(rng, 0.5, 6);   // se pasa del free time
    const tara = iso.startsWith('2') ? 2200 : 3800;
    lista.push({
      sigla_numero: `${prefijo}${String(entero(rng, 1000000, 9999999))}`,
      codigo_iso: iso, naviera, estado_carga: vacio ? 'VACIO' : 'LLENO',
      peso_tara_kg: tara, peso_bruto_kg: vacio ? tara : Math.round(tara + entre(rng, 6000, 26000)),
      ubicacion_bloque: elegir(rng, ['A', 'B', 'C', 'D', 'E', 'F']), ubicacion_bahia: String(entero(rng, 1, 40)).padStart(2, '0'),
      ubicacion_fila: String(entero(rng, 1, 8)), ubicacion_altura: entero(rng, 1, 5),
      es_reefer: reefer, temp_requerida_celsius: reefer ? elegir(rng, [-18, -18, -25, 2, 4, 13]) : null,
      codigo_imo: !vacio && rng() < 0.04 ? elegir(rng, ['3', '8', '9']) : null,
      fecha_ingreso: new Date(ingreso).toISOString(),
      fecha_limite_freetime: vacio ? null : new Date(ingreso + ft * DIA).toISOString(),
      _salida: ingreso + estadia * DIA,
    });
  }
  return lista;
}

/**
 * Contenedores en patio a la hora 'ahoraMs' (los que ya ingresaron y aún no salen).
 * @param {{ muelles?: number }[]} terminales  del maestro; dan la escala
 * @returns {object[]} filas de TCL_InventarioContenedores (sin id_puerto, fuente ni simulado: los pone el servicio)
 */
function inventarioEnPatio(clave, terminales, ahoraMs) {
  const muelles = (terminales || []).reduce((t, x) => t + Math.max(1, Number(x.muelles) || 0), 0) || 1;
  const hoy = inicioDia(ahoraMs);
  const filas = [];
  const siglas = new Set();
  for (let d = DIAS_HISTORIA; d >= 0; d--) {
    for (const c of llegadasDelDia(clave, muelles, hoy - d * DIA)) {
      if (Date.parse(c.fecha_ingreso) > ahoraMs || c._salida <= ahoraMs || siglas.has(c.sigla_numero)) continue;
      siglas.add(c.sigla_numero);
      const { _salida, ...fila } = c;
      filas.push({ ...fila, estado_operativo: 'EN_PATIO' });
    }
  }
  return filas;
}

module.exports = { PARAMETROS, NAVIERAS, llegadasDelDia, inventarioEnPatio };
