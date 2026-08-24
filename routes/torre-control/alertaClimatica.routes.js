const express = require('express');
const router = express.Router();
const AlertaClimaticaController = require('./../../controllers/torre-control/alerta-climatica.controller');

// Definimos los endpoints
router.post('/', AlertaClimaticaController.crearAlerta);
router.get('/', AlertaClimaticaController.obtenerAlertasActivas);
// router.get('/por-region/:region', AlertaClimaticaController.obtenerAlertasPorRegion);

module.exports = router;