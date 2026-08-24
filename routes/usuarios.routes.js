/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/usuarios
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");

const {
  getUsuarios,
  getUsuarioById,
  validatePassword,
  createUsuario,
  updateUsuario,
  updateUsuarioPassword,
  deleteUsuario
} = require("../controllers/usuarios");

const router = Router();

router.use(validarJWT);

router.get("/", getUsuarios);
router.get("/:id", getUsuarioById);
router.post("/validate-password", [
  validarJWT,
  check('codigoAdministrador', 'El código de administrador es obligatorio').not().isEmpty(),
  check('claveActual', 'La clave actual es obligatoria').not().isEmpty(),
  validarCampos
], validatePassword);
router.post("/", [
  check('nombreUsuario', 'El nombre de usuario es obligatorio').not().isEmpty(),
  check('identificacionUsuario', 'La identificación es obligatoria').not().isEmpty(),
  check('claveUsuario', 'La contraseña es obligatoria').not().isEmpty(),
  validarCampos
], createUsuario);
router.put("/:id", [
  validarCampos
], updateUsuario);
router.put("/password/:id", [
  validarJWT,
  check('claveUsuario', 'La nueva contraseña es obligatoria').not().isEmpty(),
  validarCampos
], updateUsuarioPassword);
router.delete("/:id", deleteUsuario);

module.exports = router;
