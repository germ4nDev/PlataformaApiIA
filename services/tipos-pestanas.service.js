const { sequelize } = require('../database/connection');
const { TipoPestanaModel, TipoPestanaDTO } = require('../models/tipo-pestana.model ');
const { getIO } = require('../helpers/socket.helper');

class TiposPestanaService {
  constructor() {
    this.model = TipoPestanaModel(sequelize);
  }

  async obtenerTiposPestana(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'codigoTipo',
          'estrategia',
          'descripcion',
          'estado'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en TiposPestanaService:", error);
      throw error;
    }
  }

  async obtenerTipoPestanaPorId(codigo) {
    const registro = await this.model.findByPk(codigo);
    if (!registro) throw { statusCode: 404, msg: 'Tipo de pestana no encontrado' };
    return TipoPestanaDTO(registro);
  }

  async crearTipoPestana(data) {
    const dataDTO = TipoPestanaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const [existente, existeNombre] = await Promise.all([
        this.model.findOne({ where: { codigoTipo: dataDTO.codigoTipo }, transaction: t }),
        this.model.findOne({ where: { estrategia: dataDTO.estrategia }, transaction: t })
      ]);

      if (existente) throw { statusCode: 400, msg: `El código ${dataDTO.codigoTipo} ya está registrado.` };
      if (existeNombre) throw { statusCode: 400, msg: `Ya existe un tipo de pestanae llamado ${dataDTO.estrategia}.` };

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('tipos-pestanaes-actualizados', {
        action: 'create',
        msg: `Tipo de pestanae creado: ${nuevo.estrategia}`
      });

      return nuevo;
    });
  }

  async actualizarTipoPestana(codigoTipo, rawData) {
    const dataDTO = TipoPestanaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipo },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de pestana para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoTipo },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoTipo },
        transaction: t
      });

      getIO().emit('tipos-pestanas-actualizados', {
        action: 'update',
        msg: `Tipo de pestana actualizado: ${actualizado.estrategia}`
      });

      return actualizado;
    });
  }

  async eliminarTipoPestana(codigoTipo) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipo },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de pestanae con ese código para eliminar." };

      const estrategiaPestana = registroDB.estrategia;

      await this.model.destroy({
        where: { codigoTipo },
        transaction: t
      });

      getIO().emit('tipos-pestanaes-actualizados', {
        action: 'delete',
        msg: `Tipo de pestana eliminado: ${estrategiaPestana}`
      });

      return true;
    });
  }
}

module.exports = TiposPestanaService;