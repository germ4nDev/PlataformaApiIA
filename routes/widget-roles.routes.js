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

const router = Router();
//router.use(validarJWT);
// router.use(validarSesion);

router.get("/", getWidgetsRoles);

router.get("/acti/:ac", getWidgetByCodeWidget);

router.get("/role/:ro", getWidgetByCodeRole);

router.post("/bulk/:id", [validarJWT, validarSesion], createBulkWidgetsRoles);

router.post("/", [validarJWT, validarSesion], createWidgetRole);

router.put("/:id", [validarJWT, validarSesion], updateWidgetRole);

router.delete("/:id", [validarJWT, validarSesion], deleteWidgetRole);

module.exports = router;