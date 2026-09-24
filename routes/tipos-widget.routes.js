const { Router } = require('express');
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getTiposWidget,
  getTipoWidgetById,
  crearTipoWidget,
  actualizarTipoWidget,
  eliminarTipoWidget
} = require('../controllers/tipos-widget.controller');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposWidget);

router.get("/:id", getTipoWidgetById);

router.post("/", [validarJWT, validarSesion], crearTipoWidget);

router.put("/:id", [validarJWT, validarSesion], actualizarTipoWidget);

router.delete("/:id", [validarJWT, validarSesion], eliminarTipoWidget);

module.exports = router;