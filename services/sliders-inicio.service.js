/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { SliderInicioModel, SliderInicioDTO } = require('../models/slider');
const { io } = require('../index');

class SliderService {
  constructor() {
    this.model = SliderInicioModel(sequelize);
  }

  async getSliders() {
    return await this.model.findAll();
  }

  async getSliderById(sliderId) {
    const registro = await this.model.findOne({ where: { sliderId } });
    if (!registro) throw { statusCode: 404, msg: "No existe el slider solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo slider para la UI
   */
  async createSlider(rawData) {
    const dataDTO = SliderInicioDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('sliders-actualizados', {
        action: 'create',
        msg: `Slider creado: ${nuevo.nombreSlider}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un slider existente
   */
  async updateSlider(codigoSlider, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = SliderInicioDTO(rawData);
    console.log('dto', dataDTO);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoSlider: codigoSlider },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el slider para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoSlider: codigoSlider },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoSlider: codigoSlider },
        transaction: t
      });

      io.emit('sliders-actualizados', {
        action: 'update',
        msg: `Slider actualizado: ${actualizado.nombreSlider}`
      });

      return actualizado;
    });
  }


  async deleteSlider(codigoSlider) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoSlider },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el slider con ese ID para eliminar.' };

      const nombreSlider = registroDB.nombreSlider;

      await this.model.destroy({
        where: { codigoSlider },
        transaction: t
      });

      io.emit('sliders-actualizados', {
        action: 'delete',
        msg: `Slider eliminado: ${nombreSlider}`
      });

      return true;
    });
  }
}

module.exports = SliderService;