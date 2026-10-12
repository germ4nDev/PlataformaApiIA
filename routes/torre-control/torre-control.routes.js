const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');

const KpisController = require('../../controllers/torre-control/kpis.controller');
const { consultarLineUp } = require('../../controllers/torre-control/line-up-maritimo.controller');
const {
  obtenerEstadoTuneles,
  obtenerBitacora,
  ejecutarSincronizacionManual
} = require('../../controllers/torre-control/torre-control.controller');
const { getCitasVirtualGate } = require('../../controllers/torre-control/citas-gate.controller');

// 🏢 Controlador de Bodegas (ubicado en la misma carpeta torre-control)
const {
  obtenerDashboardBodegas,
  obtenerMaestroBodegas,
  crearBodega,
  actualizarBodega,
  obtenerMovimientosBodega,
  registrarMovimientoBodega
} = require('../../controllers/torre-control/bodegas.controller');

// =========================================================================
// RUTAS EXISTENTES DE TORRE DE CONTROL
// =========================================================================
// Ruta: GET /api/torre-control/kpis
router.get('/kpis', KpisController.obtenerDashboard);
router.get('/lineup', validarJWT, consultarLineUp);
router.get('/estado-tuneles', obtenerBitacora);
router.post('/forzar-sincronizacion', ejecutarSincronizacionManual);
router.get('/virtual-gate', getCitasVirtualGate);

// =========================================================================
// 🏢 RUTAS DE LA PESTAÑA BODEGAS (TLC_BODEGAS_001)
// =========================================================================
// 1. Endpoint principal que llama BodegasService desde Angular:
//    GET /api/torre-control/bodegas?puerto=BUENAVENTURA
router.get('/bodegas', obtenerDashboardBodegas);

// 2. Endpoints de Maestro y Movimientos (CRUD con DTOs Joi):
router.get('/bodegas/maestro', obtenerMaestroBodegas);
router.post('/bodegas/maestro', validarJWT, crearBodega);
router.put('/bodegas/maestro/:idBodega', validarJWT, actualizarBodega);

router.get('/bodegas/movimientos', obtenerMovimientosBodega);
router.post('/bodegas/movimientos', validarJWT, registrarMovimientoBodega);

// 3. Fallback por parámetro de URL: GET /api/torre-control/bodegas/BUENAVENTURA
router.get('/bodegas/:puerto', obtenerDashboardBodegas);

module.exports = router;