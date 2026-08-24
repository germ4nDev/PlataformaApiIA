/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { ServidorModel, ServidorDTO } = require('../models/servidor');
const { io } = require('../index');

class ServidorService {
  constructor() {
    this.model = ServidorModel(sequelize);
  }

  async getServidores() {
    return await this.model.findAll();
  }

  async getServidorById(codigoServidor) {
    const registro = await this.model.findOne({ where: { codigoServidor } });
    if (!registro) throw { statusCode: 404, msg: "No existe el servidor solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo servidor en la infraestructura
   */
  async createServidor(rawData) {
    const dataDTO = ServidorDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('servidores-actualizados', {
        action: 'create',
        msg: `Servidor creado: ${nuevo.nombreServidor}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza la información de un servidor existente
   */
  async updateServidor(codigoServidor, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = ServidorDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoServidor },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el servidor para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoServidor },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoServidor },
        transaction: t
      });

      io.emit('servidores-actualizados', {
        action: 'update',
        msg: `Servidor actualizado: ${actualizado.nombreServidor}`
      });

      return actualizado;
    });
  }

  async deleteServidor(codigoServidor) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoServidor },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el servidor con ese ID para eliminar.' };

      const nombreServidor = registroDB.nombreServidor;

      await this.model.destroy({
        where: { codigoServidor },
        transaction: t
      });

      io.emit('servidores-actualizados', {
        action: 'delete',
        msg: `Servidor eliminado: ${nombreServidor}`
      });

      return true;
    });
  }
}

module.exports = ServidorService;