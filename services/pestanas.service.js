const { sequelize } = require('../database/connection');
const { PestanaModel, PestanaDTO } = require('../models/pestana.model');
const { getIO } = require('../helpers/socket.helper');

class PestanaService {
  constructor() {
    this.model = PestanaModel(sequelize);
  }

  async obtenerPestanas(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'codigoPestana',
          'nombrePestana',
          'descripcionTipo',
          'estado'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en PestranasService:", error);
      throw error;
    }
  }

  async obtenerPestanaPorId(codigo) {
    const registro = await this.model.findByPk(codigo);
    if (!registro) throw { statusCode: 404, msg: 'Pestana no encontrado' };
    return PestanaDTO(registro);
  }

  async obtenerPestanasPorContexto(codigoSuite, codigoAplicacion) {
    try {
      console.log('app', codigoAplicacion);
      console.log('sui', codigoSuite);

      const pestanas = await this.model.findAll({
        where: {
          estado: true,
          codigoAplicacion: codigoAplicacion,
          codigoSuite: codigoSuite
        },
        order: [['orden', 'ASC']]
      });
      return pestanas;
    } catch (error) {
      console.error('❌ Error en obtenerPestanasPorContexto:', error);
      throw error;
    }
  }

  async crearPestana(data) {
    const dataDTO = PestanaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const [existente, existeNombre] = await Promise.all([
        this.model.findOne({ where: { codigoPestana: dataDTO.codigoPestana }, transaction: t }),
        this.model.findOne({ where: { nombrePestana: dataDTO.nombrePestana }, transaction: t })
      ]);

      if (existente) throw { statusCode: 400, msg: `El código ${dataDTO.codigoPestana} ya está registrado.` };
      if (existeNombre) throw { statusCode: 400, msg: `Ya existe una pestana llamado ${dataDTO.nombrePestana}.` };

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('tipos-roles-actualizados', {
        action: 'create',
        msg: `Tipo de roles creado: ${nuevo.nombrePestana}`
      });

      return nuevo;
    });
  }

  async actualizarPestana(codigo, rawData) {
    const dataDTO = PestanaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoPestana },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe la pestana para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoPestana },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoPestana },
        transaction: t
      });

      getIO().emit('pestanas-actualizados', {
        action: 'update',
        msg: `Pestana actualizado: ${actualizado.nombrePestana}`
      });

      return actualizado;
    });
  }

  async eliminarPestana(codigoPestana) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoPestana },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe la pestana con ese código para eliminar." };

      const nombrePestana = registroDB.nombrePestana;

      await this.model.destroy({
        where: { codigoPestana },
        transaction: t
      });

      getIO().emit('pestanas-actualizados', {
        action: 'delete',
        msg: `Tipo de role eliminado: ${nombrePestana}`
      });

      return true;
    });
  }
}

module.exports = PestanaService;