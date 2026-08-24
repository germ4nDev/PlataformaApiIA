/*
    Author: German Valencia
    Pattern: QPLUS Controller Pattern - Operaciones Motonaves
*/
const MotonaveOperacionService = require('../../services/torre-control/motonave-operacion.service');
const { MotonaveOperacionDTO } = require('../../models/torre-control/motonave-operacion');

class MotonaveOperacionController {

  async listarOperaciones(req, res) {
    try {
      const { terminal } = req.query;

      // Se la pasamos al servicio
      const operaciones = await MotonaveOperacionService.obtenerOperacionesActivas(terminal);

      return res.status(200).json({
        success: true,
        message: 'Operaciones recuperadas exitosamente.',
        data: operaciones
      });

    } catch (error) {
      // console.error('Error en MotonaveOperacionController.listarOperaciones:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor al consultar las operaciones.'
      });
    }
  }

  async crearOperacion(req, res) {
    try {
      // 1. Extraemos los datos enviados en el body de la petición
      const rawData = req.body;

      // 2. Extraemos el contexto de seguridad (generalmente viene del middleware de autenticación de JWT)
      // Asumimos que tu middleware inyecta req.user con los datos del token
      const userContext = {
        codigoUsuario: req.user ? req.user.codigoUsuario : 'SISTEMA_TC_API'
      };

      // 3. Purificación y Ensamblaje: El DTO valida con Joi, genera el UUID y aplica la auditoría
      const dtoData = MotonaveOperacionDTO(rawData, userContext);

      // 4. Persistencia: Enviamos el DTO limpio al servicio para hacer el INSERT en SQL Server
      const registroCreado = await MotonaveOperacionService.registrarOperacion(dtoData);

      // 5. Respuesta exitosa
      return res.status(201).json({
        success: true,
        message: 'Operación de motonave registrada exitosamente.',
        data: registroCreado
      });

    } catch (error) {
      // Manejo estandarizado de errores (El escudo Joi)
      if (error.type === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Error de validación en los datos enviados.',
          errors: error.details
        });
      }

      // Manejo de errores de base de datos o servidor
      // console.error('Error en MotonaveOperacionController.crearOperacion:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor al intentar registrar la operación.'
      });
    }
  }

  async vincularMotonave(req, res) {
    try {
      // 1. Delegamos toda la lógica pesada a la capa de Servicio
      const resultado = await motonavesService.vincularMotonaveManual(req.body);

      // 2. Respuesta exitosa al cliente (Angular)
      return res.status(200).json({
        success: true,
        message: resultado.mensaje,
        data: resultado.registro
      });

    } catch (error) {
      // 3. Manejo de errores controlados (Fallas del DTO/Joi)
      if (error.type === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de vinculación inválidos o incompletos',
          errors: error.details
        });
      }

      // 4. Fallas críticas (Caída de BD, etc.)
      console.error('❌ [MotonavesController] Error crítico al vincular motonave:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al intentar procesar la vinculación en el servidor.'
      });
    }
  }
}

module.exports = new MotonaveOperacionController();