/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { ColorSettingsModel, ColorSettingsDTO } = require('../models/color-setting');
const { io } = require('../index');

class ColoresSettingsService {
  constructor() {
    this.model = ColorSettingsModel(sequelize);
  }

  async getColoresSettings() {
    return await this.model.findAll();
  }

  async getColorSettingPorId(colorNavId) {
    const registro = await this.model.findOne({ where: { colorNavId } });
    if (!registro) throw { statusCode: 404, msg: "No existe la configuración de color." };
    return registro;
  }

  /**
   * Crea una configuración de colores
   */
  async createColorSetting(rawData) {
    const dataDTO = ColorSettingsDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevoColor = await this.model.create(dataDTO, { transaction: t });

      io.emit('colores-settings-actualizadas', {
        action: 'create',
        msg: `Color Settings creado: ${nuevoColor.colorNavId}`
      });

      return nuevoColor;
    });
  }

  /**
   * Actualiza una configuración de colores
   */
  async updateColorSetting(colorNavId, rawData) {
    // rawData ya debe incluir codigoUsuario desde el controlador
    const dataDTO = ColorSettingsDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { colorNavId },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe la configuración de color para actualizar.' };

      await this.model.update(dataDTO, {
        where: { colorNavId },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { colorNavId },
        transaction: t
      });

      io.emit('colores-settings-actualizadas', {
        action: 'update',
        msg: `Color Settings actualizado: ${actualizado.colorNavId}`
      });

      return actualizado;
    });
  }

  async deleteColorSetting(colorNavId) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { colorNavId },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe la configuración de color para eliminar.' };

      await this.model.destroy({
        where: { colorNavId },
        transaction: t
      });

      io.emit('colores-settings-actualizadas', {
        action: 'delete',
        msg: `Color Settings eliminado correctamente.`
      });

      return true;
    });
  }
}

module.exports = ColoresSettingsService;