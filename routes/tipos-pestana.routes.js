const { Router } = require('express');
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getTiposPestana,
  getTipoPestanaById,
  crearTipoPestana,
  actualizarTipoPestana,
  eliminarTipoPestana
} = require('../controllers/tipos-pestana.controller');
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposPestana);

router.get("/:id", getTipoPestanaById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSPEST_CREAR')], crearTipoPestana);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSPEST_MODIFICAR')], actualizarTipoPestana);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSPEST_ELIMINAR')], eliminarTipoPestana);

module.exports = router;