/*
    Author: German Valencia
    Ruta: /api/usuarios-roles
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getSuites,
  getSuiteById,
  createSuite,
  updateSuite,
  deleteSuite
} = require("../controllers/suites-ap");

const router = Router();

// router.use(validarJWT);

router.get("/", getSuites);
router.get("/:id", validarJWT, getSuiteById);

router.post("/", [
  check('nombreSuite', 'El nombre de la suite es obligatorio').not().isEmpty(),
  validarJWT,
  validarCampos
], createSuite);

router.put("/:id", [
  validarJWT,
  validarCampos
], updateSuite);

router.delete("/:id", deleteSuite);

module.exports = router;