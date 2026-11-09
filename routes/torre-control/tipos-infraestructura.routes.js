const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const {
  getTipoInfraestructuraes,
  getTipoInfraestructuraById,
  crearTipoInfraestructura,
  updateTipoInfraestructura,
  deleteTipoInfraestructura
} = require("../../controllers/torre-control/tipos-infraestructura.controller");
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

router.get('/', getTipoInfraestructuraes);

router.get('/:id', [validarJWT], getTipoInfraestructuraById);

router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_TIPOSINFRA_CREAR')], crearTipoInfraestructura);

router.put('/:id', [validarJWT, validarSesion, validarPermiso('ACT_TIPOSINFRA_MODIFICAR')], updateTipoInfraestructura);

router.delete('/:id', [validarJWT, validarSesion, validarPermiso('ACT_TIPOSINFRA_ELIMINAR')], deleteTipoInfraestructura);

module.exports = router;
