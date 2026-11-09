/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/parametros
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarPermiso } = require('../middlewares/validar-permiso');
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getPestanas,
  getPestanasTodas,
  getPestanaById,
  getPestanaByCodeAplicacion,
  createPestana,
  updatePestana,
  deletePestana
} = require("../controllers/pestanas.controller");

const router = Router();

router.get("/", getPestanasTodas);

router.get("/:cs/:ca", getPestanas);

router.get("/:id", getPestanaById);

router.get("/app/:id", getPestanaByCodeAplicacion);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_PESTANAS_CREAR')], createPestana);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_PESTANAS_MODIFICAR')], updatePestana);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_PESTANAS_ELIMINAR')], deletePestana);

module.exports = router;