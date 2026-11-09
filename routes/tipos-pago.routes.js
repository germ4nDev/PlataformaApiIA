/*
    Author: German Valencia
    Ruta: api/facturacion/tipos-pago
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getTiposPago,
  getTipoPagoById,
  createTipoPago,
  updateTipoPago,
  deleteTipoPago
} = require("../controllers/tipos-pago.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

//router.use(validarSesion);
// Middleware central para asegurar todas las peticiones
// router.use(validarJWT);

// Rutas CRUD
router.get("/", getTiposPago);

router.get("/:id", getTipoPagoById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSPAGO_CREAR')], createTipoPago);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSPAGO_MODIFICAR')], updateTipoPago);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSPAGO_ELIMINAR')], deleteTipoPago);

module.exports = router;