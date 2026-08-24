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
  getUsuariosByRoleCode,
  getRolesPorUsuarioYEmpresa,
  getRolesByUser,
  createUsuarioRole,
  syncRoleUsers,
  syncUserRoles,
  deleteUsuarioRole,
  deleteAllUsersByRole,
  deleteAllRolesByUser
} = require("../controllers/usuarios-roles");

const router = Router();

// router.use(validarJWT);

router.get("/", getUsuariosRoles);
router.get("/:id", validarJWT, getUsuarioRoleById);
router.get("/role/:codigoRole", validarJWT, getUsuariosByRoleCode);
router.get("/usuario/:codigoUsuarioSC", validarJWT, getRolesByUser);
router.get('/usuario/:codigoUsuarioSC/empresa/:codigoEmpresaSC', getRolesPorUsuarioYEmpresa);
router.post("/", [
  check('codigoRole', 'El código de rol es obligatorio').not().isEmpty(),
  check('codigoUsuarioSC', 'El código de usuario es obligatorio').not().isEmpty(),
  check('codigoAplicacion', 'El código de aplicación es obligatorio para relacionar').not().isEmpty(),
  validarJWT,
  validarCampos
], createUsuarioRole);
router.put("/sync-role/:id", [
  check('datosRol.codigoAplicacion', 'El rol debe tener una aplicación asignada').not().isEmpty(),
  check('usuariosSeleccionados', 'usuariosSeleccionados debe ser un arreglo válido').isArray(),
  validarJWT,
  validarCampos
], syncRoleUsers);
router.put("/sync-user/:id", [
  check('rolesSeleccionados', 'rolesSeleccionados debe ser un arreglo válido').isArray(),
  validarJWT,
  validarCampos
], syncUserRoles);
router.delete("/:id", validarJWT, deleteUsuarioRole);
router.delete("/clean/:id", validarJWT, deleteAllUsersByRole);
router.delete("/clean-user/:id", validarJWT, deleteAllRolesByUser);

module.exports = router;