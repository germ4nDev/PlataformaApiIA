/*
    Author: German Valencia
    Controller: Orquestador de Endpoints para Nodos
*/
const { NodoMonitoreoDTO } = require('../../models/torre-control/nodo-monitoreo.model');
const NodoMonitoreoService = require('../../services/torre-control/nodo-monitoreo.service');

const NodoMonitoreoController = {

  registrarNodo: async (req, res) => {
    try {
      // Validación y transformación limpia
      const nodoValidado = NodoMonitoreoDTO(req.body, req.userContext);

      const nuevoNodo = await NodoMonitoreoService.crearNodo(nodoValidado, req.db);

      res.status(201).json({ success: true, data: nuevoNodo });
    } catch (error) {
      if (error.type === 'ValidationError') {
        return res.status(400).json({ success: false, errores: error.details });
      }
      res.status(500).json({ success: false, mensaje: 'Error al registrar el nodo logístico', error: error.message });
    }
  },

  listarNodosActivos: async (req, res) => {
    try {
      const nodos = await NodoMonitoreoService.obtenerNodosActivos(req.db);
      res.status(200).json({ success: true, data: nodos });
    } catch (error) {
      res.status(500).json({ success: false, mensaje: 'Error al consultar los nodos de monitoreo', error: error.message });
    }
  },

  modificarNodo: async (req, res) => {
    try {
      const { id } = req.params;
      const exito = await NodoMonitoreoService.actualizarNodo(id, req.body, req.userContext, req.db);

      if (!exito) {
        return res.status(404).json({ success: false, mensaje: 'Nodo no encontrado o sin cambios aplicados' });
      }

      res.status(200).json({ success: true, mensaje: 'Nodo actualizado correctamente' });
    } catch (error) {
      res.status(500).json({ success: false, mensaje: 'Error al actualizar el nodo logístico', error: error.message });
    }
  }
};

module.exports = NodoMonitoreoController;