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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();


router.post('/webhook', recibirWebhookMP);

// =========================================================================
// MIDDLEWARE DE SEGURIDAD (Descomentar en producción)
// =========================================================================
// router.use(validarJWT);
// router.use(validarSesion);

router.post("/procesar-crear", [validarJWT, validarSesion, validarPermiso('ACT_FACTURACION_CREAR')], procesarPagoCrear);

router.post("/manual", [validarJWT, validarSesion, validarPermiso('ACT_FACTURACION_CREAR')], createHistorialManual);

router.get("/", getHistoriales);

router.get("/:id", getHistorialById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_FACTURACION_CREAR')], createHistorial);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_FACTURACION_MODIFICAR')], updateHistorial);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_FACTURACION_ELIMINAR')], deleteHistorial);

module.exports = router;