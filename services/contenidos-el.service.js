/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { ContenidoModel, ContenidoDTO } = require('../models/contenido-el');
const { io } = require('../index');

class ContenidosELService {
  constructor() {
    this.model = ContenidoModel(sequelize);
  }

  async getContenidos() {
    return await this.model.findAll();
  }

  async getContenidoByCode(codigoContenido) {
    const registro = await this.model.findOne({ where: { codigoContenido } });
    if (!registro) throw { statusCode: 404, msg: "No existe el contenido solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo contenido e-learning
   */
  async createContenido(rawData) {
    const dataDTO = ContenidoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevoContenido = await this.model.create(dataDTO, { transaction: t });

      io.emit('contenidos-el-actualizados', {
        action: 'create',
        msg: `Contenido EL creado: ${nuevoContenido.nombreContenido}`
      });

      return nuevoContenido;
    });
  }

  /**
   * Actualiza un contenido existente
   */
  async updateContenido(codigoContenido, rawData) {
    const dataDTO = ContenidoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoContenido },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el contenido para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoContenido },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoContenido },
        transaction: t
      });

      io.emit('contenidos-el-actualizados', {
        action: 'update',
        msg: `Contenido EL actualizado: ${actualizado.nombreContenido}`
      });

      return actualizado;
    });
  }

  async deleteContenido(codigoContenido) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoContenido },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el contenido para eliminar.' };

      await this.model.destroy({
        where: { codigoContenido },
        transaction: t
      });

      io.emit('contenidos-el-actualizados', {
        action: 'delete',
        msg: `Contenido EL eliminado correctamente.`
      });

      return true;
    });
  }
}

module.exports = ContenidosELService;