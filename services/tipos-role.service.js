const { sequelize } = require('../database/connection');
const { TipoRoleModel, TipoRoleDTO } = require('../models/tipo-role.model');
const { getIO } = require('../helpers/socket.helper');

class TiposRoleService {
  constructor() {
    this.model = TipoRoleModel(sequelize);
  }

  async obtenerTiposRole(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'codigoTipoPaquete',
          'nombreTipoPaquete',
          'descripcionTipo',
          'estadoTipo'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en TiposPaqueteService:", error);
      throw error;
    }
  }

  async obtenerTipoRolePorId(codigo) {
    const registro = await this.model.findByPk(codigo);
    if (!registro) throw { statusCode: 404, msg: 'Tipo de rol no encontrado' };
    return TipoRoleDTO(registro);
  }

  async crearTipoRole(data) {
    const dataDTO = TipoRoleDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const [existente, existeNombre] = await Promise.all([
        this.model.findOne({ where: { codigoTipoRole: dataDTO.codigoTipoRole }, transaction: t }),
        this.model.findOne({ where: { nombreTipoRole: dataDTO.nombreTipoRole }, transaction: t })
      ]);

      if (existente) throw { statusCode: 400, msg: `El código ${dataDTO.codigoTipoRole} ya está registrado.` };
      if (existeNombre) throw { statusCode: 400, msg: `Ya existe un tipo de role llamado ${dataDTO.nombreTipoRole}.` };

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('tipos-roles-actualizados', {
        action: 'create',
        msg: `Tipo de roles creado: ${nuevo.nombreTipoRole}`
      });

      return nuevo;
    });
  }

  async actualizarTipoRole(codigo, rawData) {
    const dataDTO = TipoRoleDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipoRole },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de role para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoTipoRole },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoTipoRole },
        transaction: t
      });

      getIO().emit('tipos-roles-actualizados', {
        action: 'update',
        msg: `Tipo de roles actualizado: ${actualizado.nombreTipoRole}`
      });

      return actualizado;
    });
  }

  async eliminarTipoRole(codigoTipoRole) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipoRole },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de role con ese código para eliminar." };

      const nombreTipoRole = registroDB.nombreTipoRole;

      await this.model.destroy({
        where: { codigoTipoRole },
        transaction: t
      });

      getIO().emit('tipos-roles-actualizados', {
        action: 'delete',
        msg: `Tipo de role eliminado: ${nombreTipoRole}`
      });

      return true;
    });
  }
}

module.exports = TiposRoleService;