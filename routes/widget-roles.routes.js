const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getWidgetsRoles,
  getWidgetByCodeWidget,
  createBulkWidgetsRoles,
  getWidgetByCodeRole,
  createWidgetRole,
  updateWidgetRole,
  deleteWidgetRole,
} = require("../controllers/widget-roles.controller");

const router = Router();
//router.use(validarJWT);

router.get("/", getWidgetsRoles);

router.get("/acti/:ac", getWidgetByCodeWidget);

router.get("/role/:ro", getWidgetByCodeRole);

router.post("/bulk/:id", createBulkWidgetsRoles);

router.post("/", [
  check('codigoWidget', 'El código de actividad es obligatorio').not().isEmpty(),
  check('codigoRole', 'El código de rol es obligatorio').not().isEmpty(),
  validarCampos
], createWidgetRole);

router.put("/:id", [
  validarCampos
], updateWidgetRole);

router.delete("/:id", deleteWidgetRole);

module.exports = router;