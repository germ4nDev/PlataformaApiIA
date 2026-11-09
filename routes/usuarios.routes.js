/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/usuarios
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarPermiso } = require('../middlewares/validar-permiso');
// const multer = require('multer');
const { validarSesion } = require("../middlewares/validar-sesion");

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

// Lectura: JWT y sesión (catálogo compartido por varios módulos de la plataforma; sin llave propia por ahora, CC-128)
router.get("/", [validarJWT, validarSesion], getUsuarios);

router.get("/:id", [validarJWT, validarSesion], getUsuarioById);

router.post('/cargue-masivo', [validarJWT, validarSesion, validarPermiso('ACT_USR_CARGUE')], uploadMasivoUsuarios);

// Verificar la propia clave: cualquier usuario; la de otro exige ACT_USR_ACTUALIZAR
router.post("/validate-password", [
  validarJWT,
  validarSesion,
  validarPermiso('ACT_USR_ACTUALIZAR', { propio: (req) => req.body?.codigoAdministrador })
], validatePassword);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_USR_CREAR')], createUsuario);

// Sus propios datos (perfil) los actualiza cualquier usuario; los de otro exigen ACT_USR_ACTUALIZAR
router.put("/:id", [
  validarJWT,
  validarSesion,
  validarPermiso('ACT_USR_ACTUALIZAR', { propio: (req) => req.params.id })
], updateUsuario);

// La propia clave la cambia cualquier usuario; la de otro exige ACT_USR_ACTUALIZAR
router.put("/password/:id", [
  validarJWT,
  validarSesion,
  validarPermiso('ACT_USR_ACTUALIZAR', { propio: (req) => req.params.id })
], updateUsuarioPassword);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_USR_ELIMINAR')], deleteUsuario);

module.exports = router;
