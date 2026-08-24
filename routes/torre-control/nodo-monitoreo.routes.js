/*
    Author: German Valencia
    Routes: Definición de Endpoints de Infraestructura Logística
*/
const express = require('express');
const router = express.Router();
const NodoMonitoreoController = require('./../../controllers/torre-control/nodo-monitoreo.controller');

// Definición de contratos de interfaz HTTP
router.post('/', NodoMonitoreoController.registrarNodo);
router.get('/activos', NodoMonitoreoController.listarNodosActivos);
router.put('/:id', NodoMonitoreoController.modificarNodo);

module.exports = router;