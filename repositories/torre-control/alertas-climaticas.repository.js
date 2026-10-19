/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Alertas climáticas
    Description: Acceso a datos de TCL_AlertasClimaticas.
*/
const { sequelize } = require('../../database/connection');
const { AlertaClimaticaModel } = require('../../models/torre-control/alerta-climatica.model');

const Alerta = AlertaClimaticaModel(sequelize);
const plano = (f) => (f && f.get ? f.get({ plain: true }) : f);

module.exports = {
  crear: async (datos, { transaction } = {}) => plano(await Alerta.create(datos, { transaction })),
  listar: async (where) => (await Alerta.findAll({ where })).map(plano),
  /** Inserta o actualiza por codigoAlerta (alertas que llegan de fuentes oficiales con id propio). */
  guardar: async (datos) => {
    const existente = await Alerta.findByPk(datos.codigoAlerta);
    if (existente) return plano(await existente.update(datos));
    return plano(await Alerta.create(datos));
  },
};
