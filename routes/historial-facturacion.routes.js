// /*
//     Author: German Valencia
//     Ruta: api/facturacion/historial
// */
// const { Router } = require("express");
// const { validarJWT } = require("../middlewares/validar-jwt");

// const {
//   getHistoriales,
//   getHistorialById,
//   createHistorial,
//   updateHistorial,
//   deleteHistorial,
//   recibirWebhookMP,
//   procesarPagoCrear,
//   createHistorialManual,
//   cobrarConBrick
// } = require("../controllers/historial-facturacion.controller");

// const router = Router();

// // router.use(validarJWT);

// router.get("/", getHistoriales);

// router.post('/webhook', recibirWebhookMP);

// router.post("/:id/procesar-pago", cobrarConBrick);

// router.post("/:id/procesar-pagar", procesarPagoCrear);

// router.post("/manual", createHistorialManual);

// router.get("/:id", getHistorialById);

// router.post("/", createHistorial);

// router.put("/:id", updateHistorial);

// router.delete("/:id", deleteHistorial);

// module.exports = router;
/*
    Author: German Valencia
    Ruta: api/facturacion/historial
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");

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

router.post("/procesar-crear", procesarPagoCrear);

router.post("/manual", createHistorialManual);

router.get("/", getHistoriales);
router.get("/:id", getHistorialById);
router.post("/", createHistorial);
router.put("/:id", updateHistorial);
router.delete("/:id", deleteHistorial);

module.exports = router;