/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity (Sesiones)
*/
const { sequelize } = require('../database/connection');
const { SesionModel, SesionDTO } = require('../models/sesion');
const { io } = require('../index');
const crypto = require('crypto');

class SesionesService {
  constructor() {
    this.model = SesionModel(sequelize);
  }

  async getSesionesActivas() {
    try {
      return await this.model.findAll({
        where: { activa: true },
        order: [['fechaLogin', 'DESC']]
      });
    } catch (error) {
      console.error("Error en SesionesService (getSesionesActivas):", error);
      throw error;
    }
  }

  async getSesionById(codigoSesion) {
    const sesion = await this.model.findOne({
      where: { codigoSesion },
    });

    if (!sesion) {
      throw { statusCode: 404, msg: "No existe la sesión solicitada." };
    }

    return sesion;
  }

  async registrarSesion(rawData) {
    if (!rawData.codigoSesion) {
      rawData.codigoSesion = crypto.randomUUID();
    }
    if (!rawData.fechaLogin) {
      rawData.fechaLogin = new Date().toISOString();
    }

    const dataDTO = SesionDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const sesionDB = await this.model.create(dataDTO, { transaction: t });

      const listaActivas = await this.model.findAll({
        where: { activa: true },
        transaction: t
      });

      io.emit("sesiones-actualizadas", {
        action: "create",
        total: listaActivas.length,
        sesiones: listaActivas,
        msg: `Nueva sesión iniciada: ${sesionDB.nombreUsuario}`
      });

      return sesionDB;
    });
  }

  async actualizarContextoNavegacion(codigoSesion, datosContexto) {
    return await sequelize.transaction(async (t) => {
      const sesionDB = await this.model.findOne({
        where: { codigoSesion, activa: true },
        transaction: t
      });

      if (!sesionDB) {
        throw { statusCode: 404, msg: "No se encontró una sesión activa con ese identificador." };
      }

      // Actualizamos dinámicamente los códigos que vengan en el payload (suscriptor, suite, aplicacion, modulo)
      const camposActualizables = {};
      if (datosContexto.codigoSuscriptor !== undefined) camposActualizables.codigoSuscriptor = datosContexto.codigoSuscriptor;
      if (datosContexto.codigoSuite !== undefined) camposActualizables.codigoSuite = datosContexto.codigoSuite;
      if (datosContexto.codigoAplicacion !== undefined) camposActualizables.codigoAplicacion = datosContexto.codigoAplicacion;
      if (datosContexto.codigoModulo !== undefined) camposActualizables.codigoModulo = datosContexto.codigoModulo;

      await this.model.update(camposActualizables, {
        where: { codigoSesion },
        transaction: t
      });

      const listaActivas = await this.model.findAll({
        where: { activa: true },
        transaction: t
      });

      io.emit("sesiones-actualizadas", {
        action: "update",
        total: listaActivas.length,
        sesiones: listaActivas,
        msg: `Contexto de sesión actualizado para ${sesionDB.nombreUsuario}`
      });

      return { success: true, ...camposActualizables };
    });
  }

  async cerrarSesion(codigoSesion) {
    return await sequelize.transaction(async (t) => {
      const sesionDB = await this.model.findOne({
        where: { codigoSesion },
        transaction: t
      });

      if (!sesionDB) {
        throw { statusCode: 404, msg: "No existe la sesión a cerrar." };
      }

      await this.model.update({
        activa: false,
        fechaLogout: new Date().toISOString()
      }, {
        where: { codigoSesion },
        transaction: t
      });

      const listaActivas = await this.model.findAll({
        where: { activa: true },
        transaction: t
      });

      io.emit("sesiones-actualizadas", {
        action: "delete",
        total: listaActivas.length,
        sesiones: listaActivas,
        msg: `Sesión finalizada para: ${sesionDB.nombreUsuario}`
      });

      return { success: true, msg: "Sesión cerrada correctamente." };
    });
  }
}

module.exports = SesionesService;