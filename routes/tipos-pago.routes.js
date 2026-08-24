/*
    Author: German Valencia
    Ruta: api/facturacion/tipos-pago
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");

const {
  getTiposPago,
  getTipoPagoById,
  createTipoPago,
  updateTipoPago,
  deleteTipoPago
} = require("../controllers/tipos-pago.controller");

const router = Router();

// Middleware central para asegurar todas las peticiones
// router.use(validarJWT);

// Rutas CRUD
router.get("/", getTiposPago);
router.get("/:id", getTipoPagoById);
router.post("/", createTipoPago);
router.put("/:id", updateTipoPago);
router.delete("/:id", deleteTipoPago);

module.exports = router;