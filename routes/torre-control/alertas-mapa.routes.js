const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');
const AlertasMapaController = require('../../controllers/torre-control/alertas-mapa.controller');
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

router.use(validarJWT);
router.get('/', AlertasMapaController.obtenerBitacora);
router.get('/reglas', AlertasMapaController.listarReglas);
router.put('/reglas', [validarSesion, validarPermiso('ACT_ALERTAS_REGLAS')], AlertasMapaController.guardarRegla);
router.delete('/reglas/:codigo/:puerto', [
  validarSesion,
  validarPermiso('ACT_ALERTAS_REGLAS')
], AlertasMapaController.eliminarRegla);

module.exports = router;
