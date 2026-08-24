/*
    Author: German Valencia
    Pattern: QPLUS Controller Pattern - Alertas Climatics
*/
const { db, sequelize } = require('../../database/connection');
const { AlertaClimaticaDTO, AlertaClimaticaModel } = require('./../../models/torre-control/alerta-climatica.model');

const AlertaClimaticaController = {

  // POST: Crear nueva alerta
  crearAlerta: async (req, res) => {
    try {
      // 1. Recibir y Ensamblar con DTO
      const alertaValidada = AlertaClimaticaDTO(req.body, req.userContext);

      // 2. Persistir en Base de Datos (a través del Modelo)
      const nuevaAlerta = await AlertaClimaticaModel(req.db).create(alertaValidada);

      // 3. Respuesta exitosa
      res.status(201).json({
        success: true,
        data: nuevaAlerta
      });
    } catch (error) {
      // Manejo de errores QPLUS
      if (error.type === 'ValidationError') {
        res.status(400).json({ success: false, errores: error.details });
      } else {
        res.status(500).json({ success: false, mensaje: 'Error interno en Torre de Control', error });
      }
    }
  },

  // GET: Obtener alertas activas por región
  obtenerAlertasActivas: async (req, res) => {
    try {
      const alertas = await AlertaClimaticaModel(sequelize).findAll({
        where: { estadoAlerta: 'ACTIVO' }
      });
      res.status(200).json({ success: true, data: alertas });
    } catch (error) {
      // ESTA LÍNEA ES VITAL: Imprime en la consola de Node el error real de SQL
      console.error('❌ ERROR CRÍTICO EN CONTROLLER:', error);

      res.status(500).json({
        success: false,
        mensaje: 'Error al consultar alertas',
        detalle: error.message // Enviamos el detalle para que lo veas en el navegador
      });
    }
  }
};

module.exports = AlertaClimaticaController;