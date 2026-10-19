/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Eventos viales
    Description: Lecturas de TCL_EventosViales. Devuelve filas planas con lon/lat del punto.
*/
const { Op, Sequelize } = require('sequelize');
const db = require('../../models');
const { literalPunto } = require('../../helpers/geometria-segura.helper');

const { EventoVial, sequelize } = db;

/** Eventos ACTIVOS; si llega una caja {sur, norte, oeste, este} se limitan a ella. */
async function activos(caja) {
  const filtroCaja = caja ? {
    [Op.and]: [
      sequelize.where(sequelize.literal('ubicacion_geo.STY'), { [Op.between]: [caja.sur, caja.norte] }),
      sequelize.where(sequelize.literal('ubicacion_geo.STX'), { [Op.between]: [caja.oeste, caja.este] }),
    ],
  } : {};
  return EventoVial.findAll({
    raw: true,
    where: { estadoEvento: 'ACTIVO', ...filtroCaja },
    attributes: [
      'codigoEvento', 'corredorVial', 'sector', 'tipoEvento', 'descripcion', 'nivelSeveridad', 'fechaInicio',
      [sequelize.literal('ubicacion_geo.STX'), 'lon'],
      [sequelize.literal('ubicacion_geo.STY'), 'lat'],
    ],
  });
}

/**
 * Inserta o actualiza un evento por codigoEvento. ubicacion_geo llega como GeoJSON Point y se escribe
 * como geometría SQL (WKT validado).
 * @returns {'creado'|'actualizado'}
 */
async function guardar(evento) {
  const datos = { ...evento };
  if (datos.ubicacion_geo?.coordinates) {
    const [lon, lat] = datos.ubicacion_geo.coordinates;
    datos.ubicacion_geo = literalPunto(Sequelize, lon, lat);
  }
  const existente = await EventoVial.findByPk(datos.codigoEvento);
  if (existente) {
    await existente.update(datos);
    return 'actualizado';
  }
  await EventoVial.create(datos);
  return 'creado';
}

module.exports = { activos, guardar };
