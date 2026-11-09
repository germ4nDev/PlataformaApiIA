const { Router } = require('express');
const { validarSesion } = require("../middlewares/validar-sesion");
const { validarJWT } = require("../middlewares/validar-jwt");

const {
  getTiposActividades,
  getTipoActividad,
  postTipoActividad,
  putTipoActividad,
  deleteTipoActividad
} = require('../controllers/tipos-actividad.controller');
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();
// router.use(validarSesion);

router.get("/", getTiposActividades);

router.get("/:id", getTipoActividad);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSACT_CREAR')], postTipoActividad);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSACT_MODIFICAR')], putTipoActividad);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSACT_ELIMINAR')], deleteTipoActividad);

module.exports = router;