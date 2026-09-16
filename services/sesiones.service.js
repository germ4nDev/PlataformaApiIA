/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity (Sesiones)
    Updated: Integración de patrón Singleton para Sockets y Concurrencia de Sesiones
*/
const { sequelize } = require('../database/connection');
const { SesionModel, SesionDTO } = require('../models/sesion');
const { v4: uuidv4 } = require('uuid');

const { getIO } = require('../helpers/socket.helper');

class SesionesService {
  constructor() {
    this.model = SesionModel(sequelize);
  }

  async getSesionesActivas() {
    try {
      return await this.model.findAll({
        where: { activa: true },
        order: [['fechaLogin', 'DESC']]
      });
    } catch (error) {
      console.error("Error en SesionesService (getSesionesActivas):", error);
      throw error;
    }
  }

  async getSesionById(codigoSesion) {
    const sesion = await this.model.findOne({
      where: { codigoSesion },
    });

    if (!sesion) {
      throw { statusCode: 404, msg: "No existe la sesión solicitada." };
    }

    return sesion;
  }

  async registrarSesion(rawData) {
    if (!rawData.codigoSesion) {
      rawData.codigoSesion = uuidv4();
    }
    if (!rawData.fechaLogin) {
      rawData.fechaLogin = new Date().toISOString();
    }

    const dataDTO = SesionDTO(rawData);

    return await sequelize.transaction(async (t) => {
      // 1. Barrido PREVIO: Desactivamos cualquier sesión activa anterior de este mismo usuario
      await this.model.update(
        { activa: false, fechaLogout: new Date().toISOString() },
        {
          where: { codigoUsuario: dataDTO.codigoUsuario, activa: true },
          transaction: t
        }
      );

      // 2. Inserción de la nueva sesión
      const sesionDB = await this.model.create(dataDTO, { transaction: t });

      // 3. Consulta del tablero general de sesiones activas
      const listaActivas = await this.model.findAll({
        where: { activa: true },
        transaction: t
      });

      // 4. Emisión por Sockets (Blindada contra errores de instancia)
      try {
        const io = getIO();

        io.emit("sesiones-actualizadas", {
          action: "create",
          total: listaActivas.length,
          sesiones: listaActivas,
          msg: `Nueva sesión iniciada: ${sesionDB.nombreUsuario}`
        });

        // 🚨 EL GOLPE DE GRACIA: Disparamos la expulsión en navegadores viejos
        io.emit("sesion-reemplazada", {
          codigoUsuario: dataDTO.codigoUsuario,
          nuevaSesionId: dataDTO.codigoSesion
        });
      } catch (error) {
        console.warn('⚠️ [SERVICE] Alerta: No se pudo emitir el evento Socket en registrarSesion:', error.message);
      }

      // Retorno y COMMIT de SQL Server
      return sesionDB;
    });
  }

  async actualizarContextoNavegacion(codigoSesion, datosContexto) {
    // Usamos una transacción para mantener la integridad de tu arquitectura
    return await sequelize.transaction(async (t) => {

      const sesionDB = await this.model.findOne({
        where: { codigoSesion, activa: true },
        transaction: t
      });

      if (!sesionDB) {
        throw { statusCode: 404, msg: "No se encontró una sesión activa con ese identificador." };
      }



      // 1. Armamos el objeto dinámico
      const camposActualizables = { ultimaActividad: new Date().toISOString() };

      if (datosContexto.codigoSuscriptor !== undefined) camposActualizables.codigoSuscriptor = datosContexto.codigoSuscriptor;
      if (datosContexto.codigoSuite !== undefined) camposActualizables.codigoSuite = datosContexto.codigoSuite;
      if (datosContexto.codigoAplicacion !== undefined) camposActualizables.codigoAplicacion = datosContexto.codigoAplicacion;
      if (datosContexto.codigoModulo !== undefined) camposActualizables.codigoModulo = datosContexto.codigoModulo;

      // 🟢 2. AQUÍ ESTÁ LA MAGIA: Usamos this.model.update()
      await this.model.update(camposActualizables, {
        where: { codigoSesion },
        transaction: t
      });

      // 3. Consultamos la lista actualizada para el tablero de administradores
      const listaActivas = await this.model.findAll({
        where: { activa: true },
        transaction: t
      });

      // 4. Emitimos el socket general para el monitor de sesiones (Opcional pero recomendado en QPLUS)
      try {
        const io = getIO();
        io.emit("sesiones-actualizadas", {
          action: "update",
          total: listaActivas.length,
          sesiones: listaActivas,
          msg: `Contexto de sesión actualizado para ${sesionDB.nombreUsuario}`
        });
      } catch (error) {
        console.warn('⚠️ [SERVICE] Alerta: No se pudo emitir el evento Socket en actualizarContextoNavegacion:', error.message);
      }

      return { success: true, ...camposActualizables };
    });
  }

  async cerrarSesion(codigoSesion) {
    return await sequelize.transaction(async (t) => {
      const sesionDB = await this.model.findOne({
        where: { codigoSesion },
        transaction: t
      });

      if (!sesionDB) {
        throw { statusCode: 404, msg: "No existe la sesión a cerrar." };
      }

      await this.model.update({
        activa: false,
        fechaLogout: new Date().toISOString()
      }, {
        where: { codigoSesion },
        transaction: t
      });

      const listaActivas = await this.model.findAll({
        where: { activa: true },
        transaction: t
      });

      try {
        const io = getIO();
        io.emit("sesiones-actualizadas", {
          action: "delete",
          total: listaActivas.length,
          sesiones: listaActivas,
          msg: `Sesión finalizada para: ${sesionDB.nombreUsuario}`
        });
      } catch (error) {
        console.warn('⚠️ [SERVICE] Alerta: No se pudo emitir el evento Socket en cerrarSesion:', error.message);
      }

      return { success: true, msg: "Sesión cerrada correctamente." };
    });
  }
}

module.exports = SesionesService;