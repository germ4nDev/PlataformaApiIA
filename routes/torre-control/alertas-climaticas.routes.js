const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');

// Todas las rutas de este módulo requieren usuario autenticado
router.use(validarJWT);
const AlertaClimaticaController = require('./../../controllers/torre-control/alerta-climatica.controller');
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

// Definimos los endpoints
router.post('/', [validarSesion, validarPermiso('ACT_ALERTAS_CREAR')], AlertaClimaticaController.crearAlerta);
router.get('/', AlertaClimaticaController.obtenerAlertasActivas);
// router.get('/por-region/:region', AlertaClimaticaController.obtenerAlertasPorRegion);

module.exports = router;