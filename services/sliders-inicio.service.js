/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { SliderInicioModel, SliderInicioDTO } = require('../models/slider');
const { getIO } = require('../helpers/socket.helper');
const { slidesPara } = require('../utils/sliders/sliders');

class SliderService {
  constructor() {
    this.base = SliderInicioModel(sequelize);
    this.model = this.base;
    this._revisado = null;
  }

  /**
   * Slides por aplicación (CC-104): usa la columna codigoAplicacion solo si la migración 027 ya la creó.
   * Se revisa una vez; si la consulta falla, sigue con el modelo de siempre (todo general, como antes).
   */
  async modelo() {
    if (!this._revisado) {
      this._revisado = sequelize.getQueryInterface().describeTable('PTL_SliderInicio')
        .then((cols) => { this.conAplicacion = Object.keys(cols || {}).some((c) => c.toLowerCase() === 'codigoaplicacion'); })
        .catch(() => { this.conAplicacion = false; });
    }
    await this._revisado;
    if (this.conAplicacion && this.model === this.base) this.model = SliderInicioModel(sequelize, { conAplicacion: true });
    return this.model;
  }

  /** para: código de aplicación, 'general' o null (todos: la gestión). Ver utils/sliders/sliders.js. */
  async getSliders(para = null) {
    const modelo = await this.modelo();
    const filas = await modelo.findAll({ raw: true });
    return slidesPara(filas, para);
  }

  limpiarDTO(dto) {
    if (!this.conAplicacion) delete dto.codigoAplicacion;
    return dto;
  }

  async getSliderById(sliderId) {
    await this.modelo();
    // CC-141: la web y la gestión leen por codigoSlider (texto); por número, sliderId
    const registro = await this.model.findOne({ where: /^\d+$/.test(String(sliderId)) ? { sliderId: Number(sliderId) } : { codigoSlider: String(sliderId) } });
    if (!registro) throw { statusCode: 404, msg: "No existe el slider solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo slider para la UI
   */
  async createSlider(rawData) {
    await this.modelo();
    const dataDTO = this.limpiarDTO(SliderInicioDTO(rawData, 'crear'));

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('sliders-actualizados', {
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
    await this.modelo();
    const dataDTO = this.limpiarDTO(SliderInicioDTO(rawData, 'actualizar'));
    // console.log('dto', dataDTO);   // [ruido de consola: comentado 2026-10-26]

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

      getIO().emit('sliders-actualizados', {
        action: 'update',
        msg: `Slider actualizado: ${actualizado.nombreSlider}`
      });

      return actualizado;
    });
  }


  async deleteSlider(codigoSlider) {
    await this.modelo();
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

      getIO().emit('sliders-actualizados', {
        action: 'delete',
        msg: `Slider eliminado: ${nombreSlider}`
      });

      return true;
    });
  }
}

module.exports = SliderService;