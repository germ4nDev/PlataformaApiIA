/*
    Author: German Valencia
    Ruta: /api/usuarios-roles
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getUsuariosRoles,
  getUsuarioRoleById,
  createUsuarioRole,
  updateUsuarioRole,
  sincronizarRoles,
  sincronizarUsuariosRole,
  deleteUsuarioRole,
} = require("../controllers/usuarios-roles.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getUsuariosRoles);

router.get("/:id", getUsuarioRoleById);

router.post('/sincronizar', [validarJWT, validarSesion, validarPermiso('ACT_USUSC_ROLES')], sincronizarRoles);

router.post('/sincronizar-usuarios', [validarJWT, validarSesion, validarPermiso('ACT_USUSC_ROLES')], sincronizarUsuariosRole);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_USUSC_ROLES')], createUsuarioRole);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_USUSC_ROLES')], updateUsuarioRole);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_USUSC_ROLES')], deleteUsuarioRole);

module.exports = router;