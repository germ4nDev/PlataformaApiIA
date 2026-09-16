/*
    Author: German Valencia
    Ruta: api/facturacion/historial
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getHistoriales,
  getHistorialById,
  createHistorial,
  updateHistorial,
  deleteHistorial,
  recibirWebhookMP,
  procesarPagoCrear,
  createHistorialManual
} = require("../controllers/historial-facturacion.controller");

const router = Router();


router.post('/webhook', recibirWebhookMP);

// =========================================================================
// MIDDLEWARE DE SEGURIDAD (Descomentar en producción)
// =========================================================================
// router.use(validarJWT);
// router.use(validarSesion);

router.post("/procesar-crear", [validarJWT, validarSesion], procesarPagoCrear);

router.post("/manual", [validarJWT, validarSesion], createHistorialManual);

router.get("/", getHistoriales);

router.get("/:id", getHistorialById);

router.post("/", [validarJWT, validarSesion], createHistorial);

router.put("/:id", [validarJWT, validarSesion], updateHistorial);

router.delete("/:id", [validarJWT, validarSesion], deleteHistorial);

module.exports = router;