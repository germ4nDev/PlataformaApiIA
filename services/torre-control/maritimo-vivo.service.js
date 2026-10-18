/*
    Author: German Valencia
    Pattern: PORTTOS Service - KPIs marítimos en vivo (estado AIS + avisos DIMAR)
    Description: Reglas de negocio sin SQL ni HTTP (funciones puras, probadas en pruebas/maritimo-vivo.test.js).
      Estados: los que produce helpers/estado-nave.helper.js. Fechas de salida en ISO UTC.
*/
const { ESTADOS_NAVE } = require('../../helpers/estado-nave.helper');
const { normalizarPuerto } = require('../../helpers/salas.helper');
const { noEncontrado } = require('../../helpers/errores.helper');
const repositorioPorDefecto = require('../../repositories/torre-control/maritimo-vivo.repository');

const LISTA_ESTADOS = Object.values(ESTADOS_NAVE);
const ESTADOS_CRITICOS = ['VARADO', 'SIN GOBIERNO', 'EMERGENCIA'];
const ESTADOS_EN_MOVIMIENTO = ['NAVEGANDO', 'EN MANIOBRA', 'REMOLQUE', 'PESCA'];
const AIS_VIGENTE_MIN = 360;        // un reporte AIS de hace más de 6 h ya no cuenta como "en radar"
const ATRASO_TOLERANCIA_MIN = 120;

const redondear = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n)));

// ---------------------------------------------------------------- Resumen por estado

function armarResumen(puerto, filas, cola, vigenciaMin, ahora = new Date()) {
  const porEstado = Object.fromEntries(LISTA_ESTADOS.map((e) => [e, { naves: 0, minutosPromedio: null, minutosMaximo: null }]));

  for (const fila of filas) {
    // Valores heredados del motor anterior (EN MOVIMIENTO, EN TRÁNSITO...) cuentan como DESCONOCIDO
    const estado = LISTA_ESTADOS.includes(fila.estado) ? fila.estado : 'DESCONOCIDO';
    const actual = porEstado[estado];
    const navesFila = Number(fila.naves || 0);
    const naves = actual.naves + navesFila;
    porEstado[estado] = {
      naves,
      minutosPromedio: redondear(actual.naves === 0
        ? fila.minutosPromedio
        : ((actual.minutosPromedio ?? 0) * actual.naves + (fila.minutosPromedio ?? 0) * navesFila) / naves),
      minutosMaximo: redondear(Math.max(actual.minutosMaximo ?? -Infinity, fila.minutosMaximo ?? -Infinity)),
    };
  }

  const suma = (estados) => estados.reduce((t, e) => t + porEstado[e].naves, 0);
  return {
    puerto,
    generadoEn: ahora.toISOString(),
    vigenciaMin,
    totalNaves: suma(LISTA_ESTADOS),
    porEstado,
    fondeo: { ...porEstado.FONDEADO, cola: cola.map((n) => ({ ...n, minutos: redondear(n.minutos) })) },
    atracadas: porEstado.ATRACADO.naves,
    enMovimiento: suma(ESTADOS_EN_MOVIMIENTO),
    criticas: suma(ESTADOS_CRITICOS),
  };
}

// ---------------------------------------------------------------- Estadística

/** Percentil con interpolación lineal (equivale a PERCENTILE_CONT de SQL Server). */
function percentil(ordenados, p) {
  if (ordenados.length === 0) return null;
  const pos = (ordenados.length - 1) * p;
  const base = Math.floor(pos);
  const a = ordenados[base];
  const b = ordenados[Math.min(base + 1, ordenados.length - 1)];
  return a + (b - a) * (pos - base);
}

function estadistica(minutos) {
  const validos = minutos.map(Number).filter((m) => Number.isFinite(m) && m >= 0).sort((a, b) => a - b);
  if (validos.length === 0) return { eventos: 0, promedioMin: null, medianaMin: null, p90Min: null, maximoMin: null };
  return {
    eventos: validos.length,
    promedioMin: redondear(validos.reduce((t, m) => t + m, 0) / validos.length),
    medianaMin: redondear(percentil(validos, 0.5)),
    p90Min: redondear(percentil(validos, 0.9)),
    maximoMin: redondear(validos[validos.length - 1]),
  };
}

/** Colombia no tiene horario de verano: UTC-5 fijo. */
const diaColombia = (iso) => new Date(new Date(iso).getTime() - 5 * 3600000).toISOString().slice(0, 10);

function agrupar(items, clave, minutos) {
  const grupos = new Map();
  for (const item of items) {
    const k = clave(item);
    if (!k) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(minutos(item));
  }
  return [...grupos.entries()].map(([k, valores]) => ({ clave: k, ...estadistica(valores) }));
}

function armarTiempos(puerto, fondeos, estadias, dias, desde, ahora = new Date()) {
  const porDia = agrupar(fondeos, (e) => diaColombia(e.fechaEvento), (e) => e.minutos)
    .map(({ clave, ...r }) => ({ dia: clave, ...r }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
  const porTerminal = (eventos) => agrupar(eventos, (e) => e.idTerminal || 'SIN TERMINAL', (e) => e.minutos)
    .map(({ clave, ...r }) => ({ idTerminal: clave, ...r }))
    .sort((a, b) => b.eventos - a.eventos);

  return {
    puerto,
    generadoEn: ahora.toISOString(),
    desde,
    dias,
    fondeo: { resumen: estadistica(fondeos.map((e) => e.minutos)), porDia, porTerminal: porTerminal(fondeos) },
    estadia: { resumen: estadistica(estadias.map((e) => e.minutos)), porTerminal: porTerminal(estadias) },
  };
}

// ---------------------------------------------------------------- Ocupación de muelles

function armarOcupacion(puerto, muelles, naves, ahora = new Date()) {
  const navesNorm = naves.map((n) => ({ ...n, minutos: redondear(n.minutos) }));
  const terminales = new Map();

  for (const m of muelles) {
    if (!terminales.has(m.idTerminal)) {
      terminales.set(m.idTerminal, { idTerminal: m.idTerminal, nombre: m.terminal, muelles: [], navesSinMuelle: [] });
    }
    const enMuelle = navesNorm.filter((n) => n.codigoMuelle === m.codigoMuelle && (!n.idTerminal || n.idTerminal === m.idTerminal));
    terminales.get(m.idTerminal).muelles.push({ ...m, ocupado: enMuelle.length > 0, naves: enMuelle });
  }

  const ubicadas = new Set(muelles.map((m) => `${m.idTerminal}|${m.codigoMuelle}`));
  const navesSinTerminal = [];
  for (const n of navesNorm) {
    if (n.codigoMuelle && n.idTerminal && ubicadas.has(`${n.idTerminal}|${n.codigoMuelle}`)) continue;
    const terminal = n.idTerminal ? terminales.get(n.idTerminal) : undefined;
    if (terminal) terminal.navesSinMuelle.push(n);
    else navesSinTerminal.push(n);
  }

  const total = muelles.length;
  const enMantenimiento = muelles.filter((m) => m.enMantenimiento).length;
  const ocupados = [...terminales.values()].flatMap((t) => t.muelles).filter((m) => m.ocupado).length;
  const operables = total - enMantenimiento;
  return {
    puerto,
    generadoEn: ahora.toISOString(),
    resumen: {
      muelles: total,
      ocupados,
      enMantenimiento,
      disponibles: Math.max(0, operables - ocupados),
      porcentajeOcupacion: operables > 0 ? Math.round((ocupados / operables) * 100) : null,
    },
    terminales: [...terminales.values()],
    navesSinTerminal,
  };
}

// ---------------------------------------------------------------- Llegadas (DIMAR + AIS)

function situacionLlegada(a, puerto) {
  const aisVigente = a.minutosDesdeAis != null && a.minutosDesdeAis <= AIS_VIGENTE_MIN && a.latitud != null;
  if (aisVigente && a.puertoAis && a.puertoAis === puerto.idPuerto) return 'EN PUERTO';
  if (a.minutosParaEta != null && a.minutosParaEta < -ATRASO_TOLERANCIA_MIN) return 'ATRASADA';
  if (aisVigente) return 'EN RADAR';
  return 'SIN AIS';
}

function armarLlegadas(puerto, avisos, horas, ahora = new Date()) {
  const naves = avisos.map((a) => ({ ...a, situacion: situacionLlegada(a, puerto) }));
  const enRango = (desde, hasta) =>
    naves.filter((n) => n.minutosParaEta != null && n.minutosParaEta >= desde * 60 && n.minutosParaEta < hasta * 60).length;
  const cuenta = (s) => naves.filter((n) => n.situacion === s).length;
  return {
    puerto,
    generadoEn: ahora.toISOString(),
    horas,
    resumen: {
      total: naves.length,
      proximas24h: enRango(0, 24),
      de24a48h: enRango(24, 48),
      de48a72h: enRango(48, 72),
      atrasadas: cuenta('ATRASADA'),
      enRadar: cuenta('EN RADAR'),
      enPuerto: cuenta('EN PUERTO'),
      sinAis: cuenta('SIN AIS'),
    },
    naves,
  };
}

// ---------------------------------------------------------------- Servicio

class MaritimoVivoService {
  constructor(repositorio = repositorioPorDefecto) {
    this.repositorio = repositorio;
  }

  async _puerto(clave) {
    const puertoClave = normalizarPuerto(clave);
    const puerto = await this.repositorio.buscarPuerto(puertoClave);
    if (!puerto) throw noEncontrado(`No existe el puerto ${puertoClave}`);
    return puerto;
  }

  async resumen(clave, { vigenciaMin, limiteCola }) {
    const puerto = await this._puerto(clave);
    const [filas, cola] = await Promise.all([
      this.repositorio.estadosActuales(puerto.idPuerto, vigenciaMin),
      this.repositorio.colaFondeo(puerto.idPuerto, vigenciaMin, limiteCola),
    ]);
    return armarResumen(puerto, filas, cola, vigenciaMin);
  }

  async tiempos(clave, { dias }, ahora = new Date()) {
    const puerto = await this._puerto(clave);
    const desde = new Date(ahora.getTime() - dias * 86400000).toISOString();
    const [fondeos, estadias] = await Promise.all([
      this.repositorio.eventosFondeo(puerto.idPuerto, desde),
      this.repositorio.eventosEstadia(puerto.idPuerto, desde),
    ]);
    return armarTiempos(puerto, fondeos, estadias, dias, desde, ahora);
  }

  async ocupacion(clave, { vigenciaMin }) {
    const puerto = await this._puerto(clave);
    const [muelles, naves] = await Promise.all([
      this.repositorio.muellesDelPuerto(puerto.idPuerto),
      this.repositorio.navesAtracadas(puerto.idPuerto, vigenciaMin),
    ]);
    return armarOcupacion(puerto, muelles, naves);
  }

  async llegadas(clave, { horas, horasAtras, limite }) {
    const puerto = await this._puerto(clave);
    const avisos = await this.repositorio.avisosLlegada(puerto, horasAtras, horas, limite);
    return armarLlegadas(puerto, avisos, horas);
  }
}

module.exports = new MaritimoVivoService();
Object.assign(module.exports, {
  MaritimoVivoService, armarResumen, armarTiempos, armarOcupacion, armarLlegadas,
  estadistica, percentil, diaColombia, situacionLlegada,
});
