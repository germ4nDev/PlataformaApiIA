/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { ActividadModel, ActividadDTO } = require("../models/actividad");
const { io } = require("../index");

class ActividadesService {
  constructor() {
    this.model = ActividadModel(sequelize);
  }

  async getActividades(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'actividad',
          'descripcion',
          'estadoActividad'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en ActividadesService:", error);
      throw error;
    }
  }

  async getActividadPorId(codigoActividad) {
    const registro = await this.model.findOne({ where: { codigoActividad } });
    if (!registro) throw { statusCode: 404, msg: "No existe la actividad." };
    return registro;
  }

  async getActividadByCodeApp(codigoAplicacion) {
    return await this.model.findAll({ where: { codigoAplicacion } });
  }

  async getActividadByCodeSuite(codigoSuite) {
    return await this.model.findAll({ where: { codigoSuite } });
  }

  async getActividadByCodeModulo(codigoModulo) {
    return await this.model.findAll({ where: { codigoModulo } });
  }

  async createActividad(rawData) {
    const dataDTO = ActividadDTO(rawData);
    console.log('crear actividad', dataDTO);

    return await sequelize.transaction(async (t) => {
      const [existente, existeNombre, existeLlavePermiso] = await Promise.all([
        this.model.findOne({ where: { codigoActividad: dataDTO.codigoActividad }, transaction: t }),
        this.model.findOne({ where: { actividad: dataDTO.actividad }, transaction: t }),
        this.model.findOne({ where: { llavePermiso: dataDTO.llavePermiso }, transaction: t })
      ]);

      if (existente) throw { statusCode: 400, msg: "Ya existe una actividad con ese código." };
      if (existeNombre) throw { statusCode: 400, msg: "Ya existe una actividad con ese nombre." };
      if (existeLlavePermiso) throw { statusCode: 400, msg: "Ya existe una actividad con llavePermiso." };

      const actividadDB = await this.model.create(dataDTO, { transaction: t });

      io.emit("actividades-actualizadas", {
        action: "create",
        msg: `Actividad creada: ${actividadDB.actividad}`,
      });

      return actividadDB;
    });
  }

  async updateActividad(codigoActividad, rawData) {
    console.log('actualizar actividad', rawData);

    const payload = {
      ...rawData,
      codigoActividad: codigoActividad
    };

    const dataDTO = ActividadDTO(payload);
    console.log('actualizar actividad', codigoActividad);
    console.log('actualizar actividad dto', dataDTO);

    return await sequelize.transaction(async (t) => {
      const actividadDB = await this.model.findOne({ where: { codigoActividad }, transaction: t });
      if (!actividadDB) throw { statusCode: 404, msg: "No existe la actividad para actualizar." };

      await this.model.update(dataDTO, { where: { codigoActividad }, transaction: t });

      const actualizada = await this.model.findOne({ where: { codigoActividad }, transaction: t });

      io.emit("actividades-actualizadas", {
        action: "update",
        msg: `Actividad actualizada: ${actualizada.actividad}`,
      });

      return actualizada;
    });
  }

  async deleteActividad(codigoActividad) {
    return await sequelize.transaction(async (t) => {
      const actividadDB = await this.model.findOne({ where: { codigoActividad }, transaction: t });
      if (!actividadDB) throw { statusCode: 404, msg: "No existe la actividad para eliminar." };

      const nombreActividad = actividadDB.actividad;
      await this.model.destroy({ where: { codigoActividad }, transaction: t });

      io.emit("actividades-actualizadas", {
        action: "delete",
        msg: `Actividad eliminada: ${nombreActividad}`,
      });

      return true;
    });
  }
}

module.exports = ActividadesService;