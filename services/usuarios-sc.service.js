/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { UsuarioSCModel, UsuarioSCDTO } = require('../models/usuario-sc');
const { io } = require('../index');

class UsuarioSCService {
  constructor() {
    this.model = UsuarioSCModel(sequelize);
  }

  async getUsuariosSC() {
    return await this.model.findAll();
  }

  async getUsuarioSCById(codigoUsuarioSC) {
    const usuarioSC = await this.model.findOne({
      where: { codigoUsuarioSC }
    });

    if (!usuarioSC) {
      throw { statusCode: 404, msg: "No existe el usuario SC solicitado." };
    }

    return usuarioSC;
  }

  async getUsuariosSCBySuscriptorCode(codigoSuscriptor) {
    const usuariosSC = await this.model.findAll({
      where: { codigoSuscriptor }
    });

    if (!usuariosSC || usuariosSC.length === 0) {
      throw { statusCode: 404, msg: "No existen usuarios para ese suscriptor." };
    }

    return usuariosSC;
  }

  async createUsuarioSC(rawData) {
    console.log('data usuario antes dto', rawData);
    const dataDTO = UsuarioSCDTO(rawData);
    console.log('data usuario despues dto', dataDTO);

    return await sequelize.transaction(async (t) => {

      const usuarioSCDB = await this.model.findOne({
        where: {
          codigoUsuarioSC: dataDTO.codigoUsuarioSC,
          codigoUsuario: dataDTO.codigoUsuario
        },
        transaction: t
      });

      if (usuarioSCDB) {
        throw { statusCode: 409, msg: "Ya existe un registro con este usuario y este suscriptor." };
      }

      const usuarioDB = await this.model.create(dataDTO, { transaction: t });

      io.emit("usuarios-sc-actualizados", {
        action: "create",
        msg: `Usuario creado: ${usuarioDB.codigoUsuarioSC}`
      });

      return usuarioDB;
    });
  }

  async cargueMasivoUsuariosSC(fileBuffer, codigoSuscriptorFijo, usuarioCreador) {
    if (!codigoSuscriptorFijo) {
      throw { statusCode: 400, msg: 'El código del suscriptor es obligatorio para el cargue masivo.' };
    }

    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawDataArray = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rawDataArray || rawDataArray.length === 0) {
      throw { statusCode: 400, msg: 'El archivo Excel está vacío o no tiene formato válido.' };
    }

    const erroresValidacion = [];
    const operacionesProcesadas = [];

    rawDataArray.forEach((fila, index) => {
      try {
        const rawUsuario = {
          codigoUsuario: fila.codigoUsuario || crypto.randomUUID(),
          identificacionUsuario: String(fila.identificacionUsuario || ''),
          nombreUsuario: fila.nombreUsuario,
          correoUsuario: fila.correoUsuario,
          userNameUsuario: fila.userNameUsuario || '',
          claveUsuario: String(fila.claveUsuario || crypto.randomUUID().substring(0, 8)),
          descripcionUsuario: fila.descripcionUsuario || '',
          fotoUsuario: fila.fotoUsuario || 'no_imagen.png',
          usuarioAdministrador: fila.usuarioAdministrador === 'SI' || fila.usuarioAdministrador === true,
          estadoUsuario: true,
          codigoUsuarioCreacion: usuarioCreador,
          fechaCreacion: new Date().toISOString(),
          codigoUsuarioModificacion: usuarioCreador,
          fechaModificacion: new Date().toISOString()
        };

        const usuarioDTO = UsuarioDTO(rawUsuario);

        operacionesProcesadas.push({
          usuarioDTO,
          estadoUsuarioSC: fila.estadoUsuarioSC !== undefined ? (fila.estadoUsuarioSC === 'SI' || fila.estadoUsuarioSC === true) : true
        });

      } catch (error) {
        erroresValidacion.push({ filaExcel: index + 2, detalles: error.details || error });
      }
    });

    if (erroresValidacion.length > 0) {
      throw { statusCode: 400, msg: 'Errores de validación en el archivo Excel.', errores: erroresValidacion };
    }

    const resultadoTransaccion = await sequelize.transaction(async (t) => {
      const resultadosFinales = [];
      const UsuarioModel = sequelize.models.PTLUsuarios || this.model.sequelize.models.PTLUsuarios;
      const UsuariosSCModel = sequelize.models.PTLUsuariosSC || this.model;

      for (const item of operacionesProcesadas) {
        let usuarioDB = await UsuarioModel.findOne({
          where: {
            [sequelize.Sequelize.Op.or]: [
              { identificacionUsuario: item.usuarioDTO.identificacionUsuario },
              { correoUsuario: item.usuarioDTO.correoUsuario }
            ]
          },
          transaction: t
        });

        let codigoUsuarioFinal = '';

        if (usuarioDB) {
          await usuarioDB.update({
            nombreUsuario: item.usuarioDTO.nombreUsuario,
            correoUsuario: item.usuarioDTO.correoUsuario,
            userNameUsuario: item.usuarioDTO.userNameUsuario,
            descripcionUsuario: item.usuarioDTO.descripcionUsuario,
            codigoUsuarioModificacion: usuarioCreador,
            fechaModificacion: new Date().toISOString()
          }, { transaction: t });

          codigoUsuarioFinal = usuarioDB.codigoUsuario;
        } else {
          const nuevoUsuario = await UsuarioModel.create(item.usuarioDTO, { transaction: t });
          codigoUsuarioFinal = nuevoUsuario.codigoUsuario;
        }

        let relacionSC = await UsuariosSCModel.findOne({
          where: {
            codigoUsuario: codigoUsuarioFinal,
            codigoSuscriptor: codigoSuscriptorFijo
          },
          transaction: t
        });

        if (relacionSC) {
          await relacionSC.update({
            estadoUsuarioSC: item.estadoUsuarioSC,
            codigoUsuarioModificacion: usuarioCreador,
            fechaModificacion: new Date().toISOString()
          }, { transaction: t });
        } else {
          relacionSC = await UsuariosSCModel.create({
            codigoUsuarioSC: crypto.randomUUID(),
            codigoUsuario: codigoUsuarioFinal,
            codigoSuscriptor: codigoSuscriptorFijo,
            estadoUsuarioSC: item.estadoUsuarioSC,
            codigoUsuarioCreacion: usuarioCreador,
            fechaCreacion: new Date().toISOString(),
            codigoUsuarioModificacion: usuarioCreador,
            fechaModificacion: new Date().toISOString()
          }, { transaction: t });
        }

        resultadosFinales.push(relacionSC);
      }

      return resultadosFinales;
    });

    const io = global.io || (sequelize.options && sequelize.options.app ? sequelize.options.app.get('socketio') : null);
    if (io) {
      io.emit('usuarios-sc-actualizados', {
        action: "bulk_upsert",
        msg: 'Cargue masivo de usuarios completado para el suscriptor.'
      });
    }

    return {
      ok: true,
      totalProcesados: resultadoTransaccion.length,
      registros: resultadoTransaccion
    };
  }

  async updateUsuarioSC(codigoUsuarioSC, rawData) {
    const dataDTO = UsuarioSCDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const usuarioSCDB = await this.model.findOne({
        where: { codigoUsuarioSC },
        transaction: t
      });

      if (!usuarioSCDB) {
        throw { statusCode: 404, msg: "No existe el usuario SC para actualizar." };
      }

      await this.model.update(dataDTO, {
        where: { codigoUsuarioSC },
        transaction: t
      });

      const usuarioSCActualizado = await this.model.findOne({
        where: { codigoUsuarioSC },
        transaction: t
      });

      io.emit('usuarios-sc-actualizados', {
        action: 'update',
        msg: `Usuario Suscriptor actualizado: ${usuarioSCActualizado.codigoUsuarioSC}`
      });

      return usuarioSCActualizado;
    });
  }

  async deleteUsuarioSC(codigoUsuarioSC) {
    return await sequelize.transaction(async (t) => {
      const usuarioSCDB = await this.model.findOne({
        where: { codigoUsuarioSC },
        transaction: t
      });

      if (!usuarioSCDB) {
        throw { statusCode: 404, msg: "No existe el usuario SC con ese ID para eliminar." };
      }

      const codigoEliminado = usuarioSCDB.codigoUsuarioSC;

      const resultado = await this.model.destroy({
        where: { codigoUsuarioSC },
        transaction: t
      });

      io.emit('usuarios-sc-actualizados', {
        action: 'delete',
        msg: `Usuario Suscriptor eliminado: ${codigoEliminado}`
      });

      return resultado;
    });
  }
}

module.exports = UsuarioSCService;