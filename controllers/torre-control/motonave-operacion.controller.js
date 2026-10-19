/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern - Operaciones Motonaves
*/
const MotonaveOperacionService = require('../../services/torre-control/motonave-operacion.service');
const { MotonaveOperacionDTO } = require('../../models/torre-control/motonave-operacion.model');

const { responderError } = require('../../helpers/errores.helper');
const { contextoUsuario } = require('../../helpers/controlador.helper');
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
      return responderError(res, error, 'motonave-operacion.listarOperaciones');
    }
  }

  async crearOperacion(req, res) {
    try {
      // 1. Extraemos los datos enviados en el body de la petición
      const rawData = req.body;

      // 2. Extraemos el contexto de seguridad (generalmente viene del middleware de autenticación de JWT)
      // Asumimos que tu middleware inyecta req.user con los datos del token
      const userContext = contextoUsuario(req);

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
      return responderError(res, error, 'motonave-operacion.crearOperacion');
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
      return responderError(res, error, 'motonave-operacion.vincularMotonave');
    }
  }
}

module.exports = new MotonaveOperacionController();