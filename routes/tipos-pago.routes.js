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

const router = Router();

//router.use(validarSesion);
// Middleware central para asegurar todas las peticiones
// router.use(validarJWT);

// Rutas CRUD
router.get("/", getTiposPago);

router.get("/:id", getTipoPagoById);

router.post("/", [validarJWT, validarSesion], createTipoPago);

router.put("/:id", [validarJWT, validarSesion], updateTipoPago);

router.delete("/:id", [validarJWT, validarSesion], deleteTipoPago);

module.exports = router;