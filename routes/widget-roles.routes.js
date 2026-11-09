const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getWidgetsRoles,
  getWidgetByCodeWidget,
  createBulkWidgetsRoles,
  getWidgetByCodeRole,
  createWidgetRole,
  updateWidgetRole,
  deleteWidgetRole,
} = require("../controllers/widget-roles.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();
//router.use(validarJWT);
// router.use(validarSesion);

router.get("/", getWidgetsRoles);

router.get("/acti/:ac", getWidgetByCodeWidget);

router.get("/role/:ro", getWidgetByCodeRole);

router.post("/bulk/:id", [validarJWT, validarSesion, validarPermiso('ACT_WDGT_ROLES')], createBulkWidgetsRoles);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_WDGT_ROLES')], createWidgetRole);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_WDGT_ROLES')], updateWidgetRole);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_WDGT_ROLES')], deleteWidgetRole);

module.exports = router;