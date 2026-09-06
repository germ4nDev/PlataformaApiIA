/*
    Author: German Valencia
    Ruta: /api/usuarios-roles
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");

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

// router.use(validarJWT);

router.get("/", getUsuariosRoles);
router.get("/:id", getUsuarioRoleById);
router.post('/sincronizar', sincronizarRoles);
router.post('/sincronizar-usuarios', sincronizarUsuariosRole);
router.post("/", createUsuarioRole);
router.put("/:id", updateUsuarioRole);
router.delete("/:id", deleteUsuarioRole);

module.exports = router;