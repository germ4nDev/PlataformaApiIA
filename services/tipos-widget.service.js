const { sequelize } = require('../database/connection');
const { TipoWidgetModel, TipoWidgetDTO } = require('../models/tipo-widget.model');
const { getIO } = require('../helpers/socket.helper');

class TiposWidgetService {
  constructor() {
    this.model = TipoWidgetModel(sequelize);
  }

  async obtenerTiposWidget(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'codigoTipo',
          'nombreTipo',
          'descripcion',
          'estado'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en TiposWidgetService:", error);
      throw error;
    }
  }

  async obtenerTipoWidgetPorId(codigo) {
    const registro = await this.model.findByPk(codigo);
    if (!registro) throw { statusCode: 404, msg: 'Tipo de widget no encontrado' };
    return TipoWidgetDTO(registro);
  }

  async crearTipoWidget(data) {
    const dataDTO = TipoWidgetDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const [existente, existeNombre] = await Promise.all([
        this.model.findOne({ where: { codigoTipo: dataDTO.codigoTipo }, transaction: t }),
        this.model.findOne({ where: { nombreTipo: dataDTO.nombreTipo }, transaction: t })
      ]);

      if (existente) throw { statusCode: 400, msg: `El código ${dataDTO.codigoTipo} ya está registrado.` };
      if (existeNombre) throw { statusCode: 400, msg: `Ya existe un tipo de widgete llamado ${dataDTO.nombreTipo}.` };

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('tipos-widgetes-actualizados', {
        action: 'create',
        msg: `Tipo de widgetes creado: ${nuevo.nombreTipo}`
      });

      return nuevo;
    });
  }

  async actualizarTipoWidget(codigo, rawData) {
    const dataDTO = TipoWidgetDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipo },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de widget para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoTipo },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoTipo },
        transaction: t
      });

      getIO().emit('tipos-widgets-actualizados', {
        action: 'update',
        msg: `Tipo de widgets actualizado: ${actualizado.nombreTipo}`
      });

      return actualizado;
    });
  }

  async eliminarTipoWidget(codigoTipo) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipo },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de widgete con ese código para eliminar." };

      const nombreTipoWidget = registroDB.nombreTipo;

      await this.model.destroy({
        where: { codigoTipo },
        transaction: t
      });

      getIO().emit('tipos-widgetes-actualizados', {
        action: 'delete',
        msg: `Tipo de widgete eliminado: ${nombreTipoWidget}`
      });

      return true;
    });
  }
}

module.exports = TiposWidgetService;