const express = require('express');
const router = express.Router();

// Importamos el controlador que creamos hace un momento
const FlotaTerrestreController = require('../../controllers/torre-control/flota-terrestre.controller');

router.get('/activa', FlotaTerrestreController.getFlotaActiva);

router.get('/geocercas-kpis', FlotaTerrestreController.obtenerGeocercasKPIs);

router.post('/ping', FlotaTerrestreController.recibirPingGPS);

router.get('/simular-tick', FlotaTerrestreController.ejecutarSimulador);

module.exports = router;