/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { EstadoModel, EstadoDTO } = require('../models/estado');
const { io } = require('../index');

class EstadoService {
  constructor() {
    this.model = EstadoModel(sequelize);
  }

  async getEstados() {
    return await this.model.findAll();
  }

  async getEstadoPorId(estadoId) {
    const registro = await this.model.findOne({ where: { estadoId } });
    if (!registro) throw { statusCode: 404, msg: "No existe el estado solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo estado validando duplicidad por nombre
   */
  async createEstado(rawData) {
    // La sanitización ocurre antes de entrar a la lógica transaccional
    const dataDTO = EstadoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const existeNombre = await this.model.findOne({
        where: { nombreEstado: dataDTO.nombreEstado },
        transaction: t
      });

      if (existeNombre) throw { statusCode: 400, msg: 'Ya existe un estado con ese nombre.' };

      const estadoDB = await this.model.create(dataDTO, { transaction: t });

      io.emit('estados-actualizadas', {
        action: 'create',
        msg: `Estado creado: ${estadoDB.nombreEstado}`
      });

      return estadoDB;
    });
  }

  /**
   * Actualiza un estado existente
   */
  async updateEstado(estadoId, rawData) {
    // El controlador inyecta el usuario, el servicio solo recibe la data lista
    const dataDTO = EstadoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { estadoId },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el estado para actualizar.' };

      await this.model.update(dataDTO, {
        where: { estadoId },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { estadoId },
        transaction: t
      });

      io.emit('estados-actualizadas', {
        action: 'update',
        msg: `Estado actualizado: ${actualizado.nombreEstado}`
      });

      return actualizado;
    });
  }

  async deleteEstado(estadoId) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { estadoId },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el estado para eliminar.' };

      const nombreEstado = registroDB.nombreEstado;

      await this.model.destroy({
        where: { estadoId },
        transaction: t
      });

      io.emit('estados-actualizadas', {
        action: 'delete',
        msg: `Estado eliminado: ${nombreEstado}`
      });

      return true;
    });
  }
}

module.exports = EstadoService;