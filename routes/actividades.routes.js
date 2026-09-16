/*
    Author: German Valencia
    Ruta: /api/actividades
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarSesion } = require("../middlewares/validar-sesion");
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
} = require("../controllers/actividades.controller");

const router = Router();
//router.use(validarJWT);
// router.use(validarSesion);

router.get("/", getActividades);

router.get("/:id", getActividadById);

router.get("/app/:id", getActividadByCodeApp);

router.get("/suite/:id", getActividadByCodeSuite);

router.get("/modulo/:id", getActividadByCodeModulo);

router.post("/", [validarJWT, validarSesion], createActividad);

router.put("/:id", [validarJWT, validarSesion], updateActividad)

router.delete("/:id", [validarJWT, validarSesion], deleteActividad);

module.exports = router;
