/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { ParametroSistemaModel, ParametroSistemaDTO } = require('../models/parametro-sistema');
const { getIO } = require('../helpers/socket.helper');

class ParametrosSistemaService {
  constructor() {
    this.model = ParametroSistemaModel(sequelize);
  }

  async getParametros(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
        order: [['nombreParametro', 'ASC']]
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'llaveParametro',
          'nombreParametro',
          'valorParametro',
          'tipoDato'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en ParametrosSistemaService:", error);
      throw error;
    }
  }

  async getParametroById(codigoParametro) {
    const parametro = await this.model.findOne({
      where: { codigoParametro },
    });

    if (!parametro) {
      throw { statusCode: 404, msg: "No existe el parámetro solicitado." };
    }

    return parametro;
  }

  // 🟢 Método clave para el uso interno del backend (Motor de precios, Facturación, etc.)
  async getValorByLlave(llaveParametro) {
    const registro = await this.model.findOne({
      where: { llaveParametro }
    });

    if (!registro) {
      throw { statusCode: 404, msg: `El parámetro [${llaveParametro}] no existe en el sistema.` };
    }

    // Casteo automático según el tipo de dato definido
    const valor = registro.valorParametro;
    switch (registro.tipoDato) {
      case 'DECIMAL': return parseFloat(valor);
      case 'INTEGER': return parseInt(valor, 10);
      case 'BOOLEAN': return (valor === 'true' || valor === '1');
      default: return valor; // STRING
    }
  }

  async createParametro(rawData) {
    console.log('data parametro antes dto', rawData);
    const dataDTO = ParametroSistemaDTO(rawData);
    console.log('data parametro despues dto', dataDTO);

    return await sequelize.transaction(async (t) => {
      const existeLlave = await this.model.findOne({
        where: { llaveParametro: dataDTO.llaveParametro },
        transaction: t
      });

      if (existeLlave) {
        throw {
          statusCode: 400,
          msg: "Ya existe un parámetro con esa llave lógica.",
          parametro: existeLlave
        };
      }

      const parametroDB = await this.model.create(dataDTO, { transaction: t });

      getIO().emit("parametros-actualizados", {
        action: "create",
        msg: `Parámetro creado: ${parametroDB.nombreParametro}`
      });

      return parametroDB;
    });
  }

  async updateParametro(codigoParametro, rawData) {
    // Aseguramos que el código del parámetro viaje en el payload para el DTO
    rawData.codigoParametro = codigoParametro;

    console.log('data parametro antes dto', rawData);
    const dataDTO = ParametroSistemaDTO(rawData);
    console.log('data parametro despues dto', dataDTO);

    return await sequelize.transaction(async (t) => {
      const parametroDB = await this.model.findOne({
        where: { codigoParametro: dataDTO.codigoParametro },
        transaction: t
      });

      if (!parametroDB) {
        throw { statusCode: 404, msg: "No existe el parámetro con ese ID para actualizar." };
      }

      // 🟢 Blindaje: Evitamos que cambien la llave y rompan las referencias del backend
      dataDTO.llaveParametro = parametroDB.llaveParametro;

      await this.model.update(dataDTO, {
        where: { codigoParametro: dataDTO.codigoParametro },
        transaction: t
      });

      const parametroActualizado = await this.model.findOne({
        where: { codigoParametro: dataDTO.codigoParametro },
        transaction: t
      });

      getIO().emit("parametros-actualizados", {
        action: "update",
        msg: `Parámetro actualizado: ${parametroActualizado.nombreParametro}`
      });

      return parametroActualizado;
    });
  }

  async deleteParametro(codigoParametro) {
    return await sequelize.transaction(async (t) => {
      const parametroDB = await this.model.findOne({
        where: { codigoParametro },
        transaction: t
      });

      if (!parametroDB) {
        throw { statusCode: 404, msg: "No existe el parámetro con ese ID para eliminar." };
      }

      const nombreParametro = parametroDB.nombreParametro;

      const resultado = await this.model.destroy({
        where: { codigoParametro },
        transaction: t
      });

      getIO().emit("parametros-actualizados", {
        action: "delete",
        msg: `Parámetro eliminado: ${nombreParametro}`
      });

      return resultado;
    });
  }
}

module.exports = ParametrosSistemaService;