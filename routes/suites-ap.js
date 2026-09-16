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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getSuites);

router.get("/:id", getSuiteById);

router.post("/", [validarJWT, validarSesion], createSuite);

router.put("/:id", [validarJWT, validarSesion], updateSuite);

router.delete("/:id", [validarJWT, validarSesion], deleteSuite);

module.exports = router;