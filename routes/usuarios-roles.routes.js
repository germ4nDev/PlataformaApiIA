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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getUsuariosRoles);

router.get("/:id", getUsuarioRoleById);

router.post('/sincronizar', [validarJWT, validarSesion], sincronizarRoles);

router.post('/sincronizar-usuarios', [validarJWT, validarSesion], sincronizarUsuariosRole);

router.post("/", [validarJWT, validarSesion], createUsuarioRole);

router.put("/:id", [validarJWT, validarSesion], updateUsuarioRole);

router.delete("/:id", [validarJWT, validarSesion], deleteUsuarioRole);

module.exports = router;