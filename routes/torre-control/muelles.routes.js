const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const {
  getMuelles,
  getMuelleById,
  crearMuelle,
  updateMuelle,
  deleteMuelle
} = require("../../controllers/torre-control/muelle.controller");
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

router.get('/', getMuelles);

router.get('/:id', [validarJWT], getMuelleById);

router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_MUELLES_CREAR')], crearMuelle);

router.put('/:id', [validarJWT, validarSesion, validarPermiso('ACT_MUELLES_MODIFICAR')], updateMuelle);

router.delete('/:id', [validarJWT, validarSesion, validarPermiso('ACT_MUELLES_ELIMINAR')], deleteMuelle);

module.exports = router;
