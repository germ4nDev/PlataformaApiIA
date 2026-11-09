const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');
const IngestaOperacionController = require('../../controllers/torre-control/ingesta-operacion.controller');
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

router.use(validarJWT);
router.post('/:tipo', [validarSesion, validarPermiso('ACT_INGESTA_CARGAR')], IngestaOperacionController.ingerir);

module.exports = router;
