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

const router = Router();
// router.use(validarSesion);

router.get("/", getTiposActividades);

router.get("/:id", getTipoActividad);

router.post("/", [validarJWT, validarSesion], postTipoActividad);

router.put("/:id", [validarJWT, validarSesion], putTipoActividad);

router.delete("/:id", [validarJWT, validarSesion], deleteTipoActividad);

module.exports = router;