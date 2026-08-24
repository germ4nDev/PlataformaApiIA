/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { ConexionesBDModel, ConexionesBDDTO } = require('../models/conexion-bd');
const { io } = require('../index');

class ConexionesBDService {
  constructor() {
    this.model = ConexionesBDModel(sequelize);
  }

  async getConexiones() {
    return await this.model.findAll();
  }

  async getConexionPorId(codigoConexion) {
    const registro = await this.model.findOne({ where: { codigoConexion } });
    if (!registro) throw { statusCode: 404, msg: "No existe la conexión de base de datos especificada." };
    return registro;
  }

  /**
   * Crea una nueva configuración de conexión
   */
  async createConexion(rawData) {
    // Sanitización y validación a través del DTO
    const dataDTO = ConexionesBDDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevaConexion = await this.model.create(dataDTO, { transaction: t });

      io.emit('conexiones-db-actualizadas', {
        action: 'create',
        msg: `Conexión BD creada: ${nuevaConexion.nombreConexion}`
      });

      return nuevaConexion;
    });
  }

  /**
   * Actualiza una conexión existente
   */
  async updateConexion(codigoConexion, rawData) {
    // rawData debe llegar inyectada con el codigoUsuario desde el controlador
    const dataDTO = ConexionesBDDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoConexion },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe la conexión para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoConexion },
        transaction: t
      });

      const actualizada = await this.model.findOne({
        where: { codigoConexion },
        transaction: t
      });

      io.emit('conexiones-db-actualizadas', {
        action: 'update',
        msg: `Conexión BD actualizada: ${actualizada.nombreConexion}`
      });

      return actualizada;
    });
  }

  async deleteConexion(codigoConexion) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoConexion },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe la conexión para eliminar.' };

      await this.model.destroy({
        where: { codigoConexion },
        transaction: t
      });

      io.emit('conexiones-db-actualizadas', {
        action: 'delete',
        msg: `Conexión BD eliminada correctamente.`
      });

      return true;
    });
  }
}

module.exports = ConexionesBDService;