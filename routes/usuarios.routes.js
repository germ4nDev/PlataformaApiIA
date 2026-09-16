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
// router.use(validarSesion);

// const upload = multer({ storage: multer.memoryStorage() });

// router.use(validarJWT);

router.get("/", getUsuarios);

router.get("/:id", getUsuarioById);

router.post('/cargue-masivo', [validarJWT, validarSesion,
  validarPermiso('ACT_USR_CARGUE')
], uploadMasivoUsuarios);

router.post("/validate-password", [validarJWT, validarSesion], validatePassword);

router.post("/", [validarJWT, validarSesion,
  validarPermiso('ACT_USR_CREAR')
], createUsuario);

router.put("/:id", [validarJWT, validarSesion,
  validarPermiso('ACT_USR_ACTUALIZAR')
], updateUsuario);

router.put("/password/:id", [validarJWT, validarSesion], updateUsuarioPassword);

router.delete("/:id", [validarJWT, validarSesion,
  validarPermiso('ACT_USR_ELIMINAR')
], deleteUsuario);

module.exports = router;
