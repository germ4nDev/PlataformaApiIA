const { Router } = require('express');
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getTiposRole,
  getTipoRoleById,
  crearTipoRole,
  actualizarTipoRole,
  eliminarTipoRole } = require('../controllers/tipos-roles.controller');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposRole);

router.get("/:id", getTipoRoleById);

router.post("/", [validarJWT, validarSesion], crearTipoRole);

router.put("/:id", [validarJWT, validarSesion], actualizarTipoRole);

router.delete("/:id", [validarJWT, validarSesion], eliminarTipoRole);

module.exports = router;