const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');

// Todas las rutas de este módulo requieren usuario autenticado
router.use(validarJWT);
const AlertaClimaticaController = require('./../../controllers/torre-control/alerta-climatica.controller');

// Definimos los endpoints
router.post('/', AlertaClimaticaController.crearAlerta);
router.get('/', AlertaClimaticaController.obtenerAlertasActivas);
// router.get('/por-region/:region', AlertaClimaticaController.obtenerAlertasPorRegion);

module.exports = router;