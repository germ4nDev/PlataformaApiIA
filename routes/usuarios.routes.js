/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/usuarios
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
// const multer = require('multer');

const {
  getUsuarios,
  getUsuarioById,
  validatePassword,
  createUsuario,
  updateUsuario,
  updateUsuarioPassword,
  uploadMasivoUsuarios,
  deleteUsuario
} = require("../controllers/usuarios.controller");

const router = Router();

// const upload = multer({ storage: multer.memoryStorage() });

// router.use(validarJWT);

router.get("/", getUsuarios);

router.get("/:id", getUsuarioById);

router.post('/cargue-masivo', uploadMasivoUsuarios);

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
