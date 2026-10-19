/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Layouts heredados de torre de control
    Description: Tablas de layout anteriores a las PTL* de la plataforma: TLCLayout_Usuarios (widgets por usuario)
      y TLCUserDashboardLayout (tableros guardados por código). El tablero actual usa PTLLayouts.
*/
const { sequelize } = require('../../database/connection');
const { LayoutUsuarioModel } = require('../../models/torre-control/layout-usuario.model');
const { DashboardLayoutModel } = require('../../models/torre-control/dashboard-layout.model');

const LayoutUsuario = LayoutUsuarioModel(sequelize);
const TableroGuardado = DashboardLayoutModel(sequelize);

module.exports = {
  widgetsDeUsuario: (codigo_usuario, codigoDashboard) =>
    LayoutUsuario.findAll({ raw: true, where: { codigo_usuario, ...(codigoDashboard ? { codigoDashboard } : {}) } }),

  reemplazarWidgetsDeUsuario: async (codigo_usuario, filas, { transaction } = {}) => {
    await LayoutUsuario.destroy({ where: { codigo_usuario }, transaction });
    await LayoutUsuario.bulkCreate(filas, { transaction });
  },

  tableroGuardado: (codigoUsuario, codigoDashboard) => TableroGuardado.findAll({
    raw: true,
    where: { codigoUsuario, codigoDashboard },
    order: [['posicion_y', 'ASC'], ['posicion_x', 'ASC']],
  }),

  reemplazarTableroGuardado: async (codigoUsuario, codigoDashboard, filas, { transaction } = {}) => {
    await TableroGuardado.destroy({ where: { codigoUsuario, codigoDashboard }, transaction });
    await TableroGuardado.bulkCreate(filas, { transaction });
  },
};
