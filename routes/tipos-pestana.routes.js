const { Router } = require('express');
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getTiposPestana,
  getTipoPestanaById,
  crearTipoPestana,
  actualizarTipoPestana,
  eliminarTipoPestana
} = require('../controllers/tipos-pestana.controller');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposPestana);

router.get("/:id", getTipoPestanaById);

router.post("/", [validarJWT, validarSesion], crearTipoPestana);

router.put("/:id", [validarJWT, validarSesion], actualizarTipoPestana);

router.delete("/:id", [validarJWT, validarSesion], eliminarTipoPestana);

module.exports = router;