/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/usuarios
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarPermiso } = require('../middlewares/validar-permiso');
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

router.post('/cargue-masivo', [
  validarPermiso('ACT_USR_CARGUE')
], uploadMasivoUsuarios);

router.post("/validate-password", validatePassword);

router.post("/", [
  validarPermiso('ACT_USR_CREAR')
], createUsuario);

router.put("/:id", [
  validarPermiso('ACT_USR_ACTUALIZAR')
], updateUsuario);

router.put("/password/:id", updateUsuarioPassword);

router.delete("/:id", [
  validarPermiso('ACT_USR_ELIMINAR')
], deleteUsuario);

module.exports = router;
