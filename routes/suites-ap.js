/*
    Author: German Valencia
    Ruta: /api/usuarios-roles
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getSuites,
  getSuiteById,
  createSuite,
  updateSuite,
  deleteSuite
} = require("../controllers/suites-ap");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getSuites);

router.get("/:id", getSuiteById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_SUITES_CREAR')], createSuite);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SUITES_MODIFICAR')], updateSuite);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SUITES_ELIMINAR')], deleteSuite);

module.exports = router;