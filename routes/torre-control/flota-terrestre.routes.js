const express = require('express');
const router = express.Router();

// Importamos el controlador que creamos hace un momento
const FlotaTerrestreController = require('../../controllers/torre-control/flota-terrestre.controller');

const { validarJWT } = require('../../middlewares/validar-jwt');
const { validarApiKeyIngesta, soloFueraDeProduccion } = require('../../middlewares/validar-api-key');

// Ingesta GPS desde plataformas externas: autenticación por x-api-key (INGESTA_API_KEYS)
router.post('/ping', validarApiKeyIngesta, FlotaTerrestreController.recibirPingGPS);

// Consultas del tablero: usuario autenticado
router.get('/activa', validarJWT, FlotaTerrestreController.getFlotaActiva);
router.get('/geocercas-kpis', validarJWT, FlotaTerrestreController.obtenerGeocercasKPIs);

// Simulador: solo desarrollo y con usuario autenticado
router.get('/simular-tick', soloFueraDeProduccion, validarJWT, FlotaTerrestreController.ejecutarSimulador);

module.exports = router;