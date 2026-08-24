/*
    Author: German Valencia
    Refactored for: QPLUS Standard (Clean Service Layer) - Catálogo de Widgets
*/
const { sequelize } = require('../../database/connection');
const { TipoInfraestructuraModel, TipoInfraestructuraDTO } = require('../../models/torre-control/tipo-infraestructura.model');
const { io } = require('../../index');
const { where } = require('sequelize');

class TipoInfraestructurasService {
  constructor() {
    this.model = TipoInfraestructuraModel(sequelize);
  }

  // Permite buscar todos o filtrar (ej. solo los activos para el Lobby)
  async getTipoInfraestructuraes() {
    try {
      // Obtenemos los datos limpios
      const resultados = await this.model.findAll({ raw: true });
      return {
        ok: true,
        data: resultados,
        statusCode: 200
      };
    } catch (error) {
      console.error("🔴 Error en TipoInfraestructurasService (getTipoInfraestructuraes):", error);
      throw error;
    }
  }

  async getTipoInfraestructuraById(id_tipo) {
    try {
      const registro = await this.model.findOne({ where: { id_tipo } });
      if (!registro) throw { statusCode: 404, msg: "No existe el tipo de infraestructura pur su Id." };
      return registro;
    } catch (error) {
      console.error("🔴 Error en TipoInfraestructurasService (getTipoInfraestructuraById):", error);
      throw error;
    }
  }

  async crearTipoInfraestructura(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      // 1. Saneamiento y Validación (Escudo QPLUS)
      const dataDTO = TipoInfraestructuraDTO(rawData, userContext);

      return await sequelize.transaction(async (t) => {
        const nuevoTipoInfraestructura = await this.model.create(dataDTO, { transaction: t });
        console.log('✅ TipoInfraestructura creado en BD:', nuevoTipoInfraestructura.toJSON());

        // 3. Reactividad
        if (typeof io !== 'undefined') {
          io.emit('tipos-infraestructura-actualizados', {
            action: 'create',
            msg: `Nuevo tipo infraestructura registrado: ${nuevoTipoInfraestructura.nombre}`
          });
        }

        return nuevoTipoInfraestructura;
      });

    } catch (error) {
      console.error('🔴 Error COMPLETO en crearTipoInfraestructura:', error);
      throw error;
    }
  }

  // async updateTipoInfraestructura(id_tipo, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
  //   try {
  //     console.log('id_tipo', id_tipo);
  //     console.log('rawData', rawData);

  //     const dataDTO = TipoInfraestructuraDTO(rawData, userContext);
  //     console.log('dataDTO', dataDTO);

  //     return await sequelize.transaction(async (t) => {
  //       const dbTipoInfraestructura = await this.model.findOne({
  //         where: { id_tipo },
  //         transaction: t
  //       });

  //       if (!dbTipoInfraestructura) {
  //         throw { statusCode: 404, msg: "No existe el tipo para actualizar." };
  //       }

  //       await this.model.update(dataDTO, {
  //         where: { id_tipo },
  //         transaction: t
  //       });

  //       const actualizado = await this.model.findOne({
  //         where: { id_tipo },
  //         transaction: t
  //       });

  //       if (typeof io !== 'undefined') {
  //         io.emit('tipos-infraestructura-actualizados', {
  //           action: 'update',
  //           msg: `TipoInfraestructura actualizado: ${actualizado.nombre}`
  //         });
  //       }

  //       return actualizado;
  //     });

  //   } catch (error) {
  //     console.error(`🔴 Error en updateTipoInfraestructura:`, error.msg || error.message);
  //     throw error;
  //   }
  // }
  async updateTipoInfraestructura(id_tipo, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      // 1. Validar y limpiar la data entrante
      const dataDTO = TipoInfraestructuraDTO(rawData, userContext);
      console.log('datos del dto en el servicio', dataDTO);

      // NOTA: Si NO quieres sobrescribir la fecha/usuario de creación original en BD,
      // descomenta las siguientes dos líneas para que Sequelize no las incluya en el UPDATE:
      delete dataDTO.usuario_cargue;
      delete dataDTO.fecha_cargue;

      // 2. Ejecutar transacción segura referenciando la instancia de sequelize del modelo
      return await this.model.sequelize.transaction(async (t) => {

        // 3. Verificar existencia
        const dbTipoInfraestructura = await this.model.findOne({
          where: { id_tipo },
          transaction: t
        });

        if (!dbTipoInfraestructura) {
          throw { statusCode: 404, msg: `No existe un tipo de infraestructura con el ID: ${id_tipo}` };
        }

        // 4. Actualizar
        await this.model.update(dataDTO, {
          where: { id_tipo },
          transaction: t
        });

        // 5. Recuperar el registro actualizado
        const actualizado = await this.model.findOne({
          where: { id_tipo },
          transaction: t
        });

        // 6. Emitir evento por WebSockets si IO está disponible
        if (typeof io !== 'undefined') {
          io.emit('tipos-infraestructura-actualizados', {
            action: 'update',
            msg: `Tipo de Infraestructura actualizado: ${actualizado.nombre}`
          });
        }

        return actualizado;
      });

    } catch (error) {
      console.error(`🔴 Error en updateTipoInfraestructura:`, error.msg || error.message);
      // Mantener el formato QPLUS de errores
      throw {
        statusCode: error.type === 'ValidationError' ? 400 : (error.statusCode || 500),
        msg: error.type === 'ValidationError' ? 'Error de validación de datos' : (error.msg || 'Error interno al actualizar'),
        details: error.details || error
      };
    }
  }

  async deleteTipoInfraestructura(id_tipo) {
    try {
      return await sequelize.transaction(async (t) => {
        const dbTipoInfraestructura = await this.model.findOne({
          where: { id_tipo },
          transaction: t
        });

        if (!dbTipoInfraestructura) {
          throw { statusCode: 404, msg: "No existe un terminal con ese id." };
        }

        await this.model.destroy({
          where: { id_tipo },
          transaction: t
        });

        if (typeof io !== 'undefined') {
          io.emit('tipos-infraestructura-actualizados', {
            action: 'delete',
            msg: `TipoInfraestructura eliminado: ${dbTipoInfraestructura.nombre}`
          });
        } else {
          console.warn('⚠️ Objeto IO no definido. Se eliminó en BD pero no se notificó por socket.');
        }

        return dbTipoInfraestructura;
      });

    } catch (error) {
      console.error(`🔴 Error en deleteTipoInfraestructura (Rollback):`, error.msg || error.message);
      throw error;
    }
  }
}

module.exports = TipoInfraestructurasService;