/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Eventos viales
    Description: Lecturas y escrituras de TCL_EventosViales. Devuelve filas planas con lon/lat del punto.
      Ciclo de vida (migración 014, reglas en utils/eventos-viales.js): ACTIVO → DESPEJADO con motivoCierre y
      fechaFin. Lo que se muestra: ACTIVO, sin fechaFin vencida y, si es de TomTom, reportado en las últimas 24 h.
      Sin la migración 014 se usa la regla anterior (reportados hoy, por fechaModificacion) y no se despeja nada.
*/
const { Op, Sequelize, QueryTypes } = require('sequelize');
const db = require('../../models');
const { literalPunto } = require('../../helpers/geometria-segura.helper');
const { inicioDiaColombia } = require('../../utils/tablero-comun');
const { VIGENCIA_MAX_MS, FUENTE_TOMTOM } = require('../../utils/eventos-viales');

const { EventoVial, sequelize } = db;

const ESTADO_ACTIVO = 'ACTIVO';
const ESTADO_DESPEJADO = 'DESPEJADO';
const ATRIBUTOS_BASE = ['codigoEvento', 'corredorVial', 'sector', 'tipoEvento', 'descripcion', 'nivelSeveridad', 'estadoEvento', 'fechaInicio', 'fechaFin'];
const ATRIBUTOS_CICLO = ['fuente', 'zonaFuente', 'fechaUltimoReporte', 'ausencias', 'motivoCierre'];
const COORDENADAS = () => [
  [sequelize.literal('ubicacion_geo.STX'), 'lon'],
  [sequelize.literal('ubicacion_geo.STY'), 'lat'],
];

// ── ¿Está la migración 014? (se cachea el sí; el no se vuelve a mirar cada 5 min) ──────────────────────────
let ciclo = { valor: null, hasta: 0 };
async function conCicloDeVida() {
  if (ciclo.valor === true || Date.now() < ciclo.hasta) return ciclo.valor === true;
  const [fila] = await sequelize.query("SELECT COL_LENGTH('dbo.TCL_EventosViales', 'fechaUltimoReporte') AS c", { type: QueryTypes.SELECT });
  const hay = fila?.c !== null && fila?.c !== undefined;
  ciclo = { valor: hay, hasta: hay ? Infinity : Date.now() + 5 * 60000 };
  if (!hay) console.warn('[EventosViales] Sin migración 014: regla anterior (reportados hoy) y sin despeje automático.');
  return hay;
}

/** Para pruebas: fija si hay migración sin consultar la base. */
function _fijarCicloDeVida(valor) {
  ciclo = { valor, hasta: valor ? Infinity : Date.now() + 5 * 60000 };
}

/** Condición de lo que se muestra (mapa, noticias, alertas, simulador, KPI). */
async function condicionVigentes(ahora = new Date()) {
  if (!(await conCicloDeVida())) {
    // Regla anterior: lo que la sincronización reportó hoy (hora de Colombia)
    const desde = new Date(inicioDiaColombia(ahora.getTime()));
    return { estadoEvento: ESTADO_ACTIVO, fechaModificacion: { [Op.gte]: desde }, [Op.or]: [{ fechaFin: null }, { fechaFin: { [Op.gte]: desde } }] };
  }
  return {
    estadoEvento: ESTADO_ACTIVO,
    [Op.and]: [
      { [Op.or]: [{ fechaFin: null }, { fechaFin: { [Op.gt]: ahora } }] },
      { [Op.or]: [
        { fuente: null },
        { fuente: { [Op.ne]: FUENTE_TOMTOM } },
        { fechaUltimoReporte: { [Op.gte]: new Date(ahora.getTime() - VIGENCIA_MAX_MS) } },
      ] },
    ],
  };
}

/**
 * Eventos vigentes; si llega una caja {sur, norte, oeste, este} se limitan a ella.
 * @param {object|null} caja
 * @param {{ ahora?: Date }} [opciones]  para pruebas
 */
async function activos(caja, { ahora = new Date() } = {}) {
  const where = await condicionVigentes(ahora);
  const filtroCaja = caja ? {
    [Op.and]: [
      ...(where[Op.and] || []),
      sequelize.where(sequelize.literal('ubicacion_geo.STY'), { [Op.between]: [caja.sur, caja.norte] }),
      sequelize.where(sequelize.literal('ubicacion_geo.STX'), { [Op.between]: [caja.oeste, caja.este] }),
    ],
  } : {};
  const extra = (await conCicloDeVida()) ? ATRIBUTOS_CICLO : [];
  return EventoVial.findAll({
    raw: true,
    where: { ...where, ...filtroCaja },
    attributes: [...ATRIBUTOS_BASE, ...extra, ...COORDENADAS()],
  });
}

/** Cuántos eventos vigentes hay (KPI de alertas viales de Marítimo). */
async function contarVigentes({ ahora = new Date() } = {}) {
  return EventoVial.count({ where: await condicionVigentes(ahora) });
}

/** Todos los ACTIVO con lo que necesita la reconciliación (sin filtro de vigencia). Requiere la 014. */
async function activosParaReconciliar() {
  return EventoVial.findAll({
    raw: true,
    where: { estadoEvento: ESTADO_ACTIVO },
    attributes: [...ATRIBUTOS_BASE, ...ATRIBUTOS_CICLO, ...COORDENADAS()],
  });
}

/** Un evento por código (cualquier estado), con su punto. */
async function obtener(codigoEvento, { transaction } = {}) {
  const extra = (await conCicloDeVida()) ? ATRIBUTOS_CICLO : [];
  return EventoVial.findOne({
    raw: true, transaction,
    where: { codigoEvento },
    attributes: [...ATRIBUTOS_BASE, ...extra, ...COORDENADAS()],
  });
}

const conGeometria = (datos) => {
  const salida = { ...datos };
  if (salida.ubicacion_geo?.coordinates) {
    const [lon, lat] = salida.ubicacion_geo.coordinates;
    salida.ubicacion_geo = literalPunto(Sequelize, lon, lat);
  }
  return salida;
};

const auditoria = (usuario, ahora) => ({ codigoUsuarioModificacion: String(usuario).substring(0, 200), fechaModificacion: ahora });

/**
 * Escribe el resultado de reconciliar() (utils/eventos-viales.js). El servicio abre la transacción.
 * @param {{nuevos, vistos, ausentes, resueltos}} cambios
 * @param {{ transaction?: object, usuario?: string, ahora?: Date }} opciones
 */
async function aplicarCiclo({ nuevos = [], vistos = [], ausentes = [], resueltos = [] }, { transaction, usuario = 'SYS_CRON_TOMTOM', ahora = new Date() } = {}) {
  const audit = auditoria(usuario, ahora);
  const columnasEvento = (e) => conGeometria({
    corredorVial: e.corredorVial, sector: e.sector, tipoEvento: e.tipoEvento, descripcion: e.descripcion,
    nivelSeveridad: e.nivelSeveridad, ubicacion_geo: e.ubicacion_geo, fechaInicio: e.fechaInicio, fechaFin: e.fechaFin || null,
    estadoEvento: ESTADO_ACTIVO, fuente: e.fuente, zonaFuente: e.zonaFuente, fechaUltimoReporte: e.fechaUltimoReporte,
    ausencias: 0, motivoCierre: null, ...audit,
  });

  for (const e of nuevos) {
    const existe = await EventoVial.findOne({ raw: true, transaction, where: { codigoEvento: e.codigoEvento }, attributes: ['codigoEvento'] });
    const datos = columnasEvento(e);
    if (existe) {
      // Mismo id que vuelve a aparecer (estaba DESPEJADO): se reactiva
      await EventoVial.update(datos, { where: { codigoEvento: e.codigoEvento }, transaction });
    } else {
      const fila = { codigoEvento: e.codigoEvento, ...datos, codigoUsuarioCreacion: audit.codigoUsuarioModificacion, fechaCreacion: ahora };
      await EventoVial.create(fila, { transaction, fields: Object.keys(fila) });
    }
  }
  for (const e of vistos) {
    await EventoVial.update(columnasEvento(e), { where: { codigoEvento: e.codigoEvento }, transaction });
  }
  for (const a of ausentes) {
    await EventoVial.update({ ausencias: a.ausencias, zonaFuente: a.zonaFuente }, { where: { codigoEvento: a.codigoEvento, estadoEvento: ESTADO_ACTIVO }, transaction });
  }
  for (const r of resueltos) {
    await EventoVial.update(
      { estadoEvento: ESTADO_DESPEJADO, fechaFin: r.fechaFin, motivoCierre: r.motivo, ...audit },
      { where: { codigoEvento: r.codigoEvento, estadoEvento: ESTADO_ACTIVO }, transaction });
  }
}

/**
 * Despeje manual (operador). Solo afecta eventos ACTIVO.
 * @returns {Promise<boolean>} true si se despejó
 */
async function despejar(codigoEvento, { usuario, ahora = new Date(), transaction } = {}) {
  const [filas] = await EventoVial.update(
    { estadoEvento: ESTADO_DESPEJADO, fechaFin: ahora, motivoCierre: 'MANUAL', ...auditoria(usuario || 'OPERADOR', ahora) },
    { where: { codigoEvento, estadoEvento: ESTADO_ACTIVO }, transaction });
  return filas > 0;
}

/**
 * Regla anterior a la 014 (sin ciclo de vida): inserta o actualiza por codigoEvento.
 * @returns {'creado'|'actualizado'}
 */
async function guardar(evento) {
  const datos = conGeometria(evento);
  const existente = await EventoVial.findOne({ where: { codigoEvento: datos.codigoEvento }, attributes: ['codigoEvento'] });
  if (existente) {
    await EventoVial.update(datos, { where: { codigoEvento: datos.codigoEvento }, fields: Object.keys(datos).filter((k) => !ATRIBUTOS_CICLO.includes(k)) });
    return 'actualizado';
  }
  const fila = Object.fromEntries(Object.entries(datos).filter(([k]) => !ATRIBUTOS_CICLO.includes(k)));
  await EventoVial.create(fila, { fields: Object.keys(fila) });
  return 'creado';
}

module.exports = {
  ESTADO_ACTIVO, ESTADO_DESPEJADO,
  conCicloDeVida, condicionVigentes, activos, contarVigentes, activosParaReconciliar, obtener,
  aplicarCiclo, despejar, guardar, _fijarCicloDeVida,
};
