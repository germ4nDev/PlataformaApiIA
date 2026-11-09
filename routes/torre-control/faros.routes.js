const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const {
  getFaros,
  getFaroById,
  crearFaro,
  updateFaro,
  deleteFaro
} = require("../../controllers/torre-control/faro.controller");
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

// Seguridad 2026-10-17: antes era público (exponía todas las geocercas y peajes sin sesión).
// El front solo lo llama con sesión iniciada (AppComponent.loadProtectedData y el mapa).
router.get('/', [validarJWT], getFaros);

router.get('/:id', [validarJWT], getFaroById);

router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_FAROS_CREAR')], crearFaro);

router.put('/:id', [validarJWT, validarSesion, validarPermiso('ACT_FAROS_MODIFICAR')], updateFaro);

router.delete('/:id', [validarJWT, validarSesion, validarPermiso('ACT_FAROS_ELIMINAR')], deleteFaro);

module.exports = router;
