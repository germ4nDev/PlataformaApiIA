/*
    Author: German Valencia
    Ruta: api/paquetes/tipos-paquete
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getTiposPaquete,
  getTipoPaqueteById,
  createTipoPaquete,
  updateTipoPaquete,
  deleteTipoPaquete
} = require("../controllers/tipos-paquete.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// Middleware central
// router.use(validarJWT);

// Rutas CRUD
router.get("/", getTiposPaquete);

router.get("/:id", getTipoPaqueteById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSPAQ_CREAR')], createTipoPaquete);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSPAQ_MODIFICAR')], updateTipoPaquete);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSPAQ_ELIMINAR')], deleteTipoPaquete);

module.exports = router;