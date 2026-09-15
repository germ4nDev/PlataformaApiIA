/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/sesiones
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarPermiso } = require('../middlewares/validar-permiso');

const {
  getSesionesActivas,
  getSesionById,
  registrarSesion,
  actualizarContextoNavegacion,
  cerrarSesion
} = require("../controllers/sesiones.controller");

const router = Router();

// router.use(validarJWT);

router.get("/", [
  validarPermiso('ACT_SESIONES_VER')
], getSesionesActivas);

router.get("/:id", [
  validarPermiso('ACT_SESIONES_VER')
], getSesionById);

router.post("/", registrarSesion);

router.put("/contexto/:id", actualizarContextoNavegacion);

router.delete("/:id", cerrarSesion);

module.exports = router;