/*
    Author: German Valencia
    Ruta: /api/actividades
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getActividades,
  getActividadById,
  getActividadByCodeApp,
  getActividadByCodeSuite,
  getActividadByCodeModulo,
  createActividad,
  updateActividad,
  deleteActividad,
} = require("../controllers/actividades");

const router = Router();
//router.use(validarJWT);

router.get("/", getActividades);

router.get("/:id", getActividadById);

router.get("/app/:id", getActividadByCodeApp);

router.get("/suite/:id", getActividadByCodeSuite);

router.get("/modulo/:id", getActividadByCodeModulo);

router.post("/", [
  check('codigoActividad', 'El código de actividad es obligatorio').not().isEmpty(),
  check('codigoAplicacion', 'El código de la aplicacion es obligatorio').not().isEmpty(),
  check('codigoSuite', 'El código de la suite es obligatorio').not().isEmpty(),
  check('codigoModulo', 'El código del modulo es obligatorio').not().isEmpty(),
  validarCampos
], createActividad);

router.put("/:id", [
  check('codigoAplicacion', 'El código de la aplicacion es obligatorio').not().isEmpty(),
  check('codigoSuite', 'El código de la suite es obligatorio').not().isEmpty(),
  check('codigoModulo', 'El código del modulo es obligatorio').not().isEmpty(),
  validarCampos
], updateActividad)

router.delete("/:id", deleteActividad);

module.exports = router;
