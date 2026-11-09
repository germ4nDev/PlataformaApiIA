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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposWidget);

router.get("/:id", getTipoWidgetById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSWDGT_CREAR')], crearTipoWidget);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSWDGT_MODIFICAR')], actualizarTipoWidget);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSWDGT_ELIMINAR')], eliminarTipoWidget);

module.exports = router;