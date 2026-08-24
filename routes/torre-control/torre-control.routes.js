const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const KpisController = require('../../controllers/torre-control/kpis.controller')
const {
  consultarLineUp
} = require('../../controllers/torre-control/line-up-maritimo.controller');
const {
  obtenerEstadoTuneles,
  obtenerBitacora,
  ejecutarSincronizacionManual
} = require('../../controllers/torre-control/torre-control.controller');

// Ruta: GET /api/torre-control/kpis
router.get('/kpis', KpisController.obtenerDashboard);
router.get('/lineup', validarJWT, consultarLineUp);
router.get('/estado-tuneles', obtenerBitacora);
router.post('/forzar-sincronizacion', ejecutarSincronizacionManual);
module.exports = router;