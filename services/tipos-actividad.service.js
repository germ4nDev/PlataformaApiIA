/*
    Author: German Valencia
    Description: Servicio para la gestión del Maestro de Tipos de Actividad
*/
const { sequelize } = require('../database/connection');
const { TipoActividadModel, TipoActividadDTO } = require('../models/tipos-actividad.model');

// Instanciamos el modelo
const TipoActividad = TipoActividadModel(sequelize);

class TiposActividadService {

  async obtenerTodos() {
    return await TipoActividad.findAll({
      order: [['nombreTipoActividad', 'ASC']]
    });
  }

  async obtenerPorId(codigoTipoActividad) {
    return await TipoActividad.findByPk(codigoTipoActividad);
  }

  async crear(data) {
    // Validamos con el DTO (Joi) antes de tocar la BD
    const dataValida = TipoActividadDTO(data);

    // Verificamos si el código ya existe para evitar errores SQL
    const existe = await TipoActividad.findByPk(dataValida.codigoTipoActividad);
    if (existe) {
      throw { type: 'DuplicationError', msg: 'El código del tipo de actividad ya existe.' };
    }

    return await TipoActividad.create(dataValida);
  }

  async actualizar(codigoTipoActividad, data) {
    const dataValida = TipoActividadDTO(data);

    const registro = await TipoActividad.findByPk(codigoTipoActividad);
    if (!registro) {
      throw { type: 'NotFoundError', msg: 'Tipo de actividad no encontrado.' };
    }

    await registro.update(dataValida);
    return registro;
  }

  async eliminar(codigoTipoActividad) {
    const registro = await TipoActividad.findByPk(codigoTipoActividad);
    if (!registro) {
      throw { type: 'NotFoundError', msg: 'Tipo de actividad no encontrado.' };
    }

    await registro.destroy();
    return registro;
  }
}

module.exports = new TiposActividadService();