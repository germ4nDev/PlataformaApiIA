const { Router } = require("express");
const { validarJWT } = require("../../middlewares/validar-jwt");
const { validarSesion } = require("../../middlewares/validar-sesion");

const {
  iniciarSimulador,
  detenerSimulador,
  getHistorialFlujo
} = require("../../controllers/torre-control/gnl-telemetria.controller");
const { validarPermiso } = require('../../middlewares/validar-permiso');

const router = Router();

// Endpoints de control del simulador (Ideal para encenderlo antes de una demo)[validarJWT, validarSesion], 
router.post("/simulador/start", [validarJWT, validarSesion, validarPermiso('ACT_SIMULADOR_CONTROLAR')], iniciarSimulador);
router.post("/simulador/stop", [validarJWT, validarSesion, validarPermiso('ACT_SIMULADOR_CONTROLAR')], detenerSimulador);

// Endpoint para que Angular pinte la gráfica histórica al abrir la pestaña
router.get("/historial/:id_puerto", [validarJWT, validarSesion], getHistorialFlujo);

module.exports = router;