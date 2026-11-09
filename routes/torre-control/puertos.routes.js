const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const {
  getPuertos,
  getPuertoById,
  crearPuerto,
  updatePuerto,
  deletePuerto
} = require("../../controllers/torre-control/puertos.controller");
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

router.get('/', getPuertos);

router.get('/:id', [validarJWT], getPuertoById);

router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_PUERTOS_CREAR')], crearPuerto);

router.put('/:id', [validarJWT, validarSesion, validarPermiso('ACT_PUERTOS_MODIFICAR')], updatePuerto);

router.delete('/:id', [validarJWT, validarSesion, validarPermiso('ACT_PUERTOS_ELIMINAR')], deletePuerto);

module.exports = router;
