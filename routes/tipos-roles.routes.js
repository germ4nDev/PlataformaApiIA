const { Router } = require('express');
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getTiposRole,
  getTipoRoleById,
  crearTipoRole,
  actualizarTipoRole,
  eliminarTipoRole } = require('../controllers/tipos-roles.controller');
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposRole);

router.get("/:id", getTipoRoleById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSROLE_CREAR')], crearTipoRole);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSROLE_MODIFICAR')], actualizarTipoRole);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSROLE_ELIMINAR')], eliminarTipoRole);

module.exports = router;