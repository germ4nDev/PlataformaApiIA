/*
    Author: German Valencia
    Router: Bodegas y Silos - Tablero de Control (TLC_BODEGAS_001)
    Base Path sugerido: /api/tablero-control/bodegas
*/
const { Router } = require('express');
const {
  obtenerDashboardBodegas,
  obtenerMaestroBodegas,
  crearBodega,
  actualizarBodega,
  obtenerMovimientosBodega,
  registrarMovimientoBodega,
  obtenerOcupacionBodegas,
  obtenerMovimientosRango
} = require('../../controllers/torre-control/bodegas.controller');

// Si utilizas middleware de autenticación JWT en QPLUS/PORTTOS, descoméntalo aquí:
// const { validarJWT } = require('../../middlewares/validar-jwt');

const router = Router();

// =========================================================================
// 1. ENDPOINTS PARA SMART WIDGETS (Consolidado con shareReplay(1) en Angular)
// =========================================================================
// Soporta query param: GET /api/tablero-control/bodegas?puerto=BUENAVENTURA
// Toda la ruta exige sesión (antes estaba abierta, incluso POST /maestro y POST /movimientos)
const { validarJWT } = require('../../middlewares/validar-jwt');
router.use(validarJWT);
router.get('/', obtenerDashboardBodegas);

// =========================================================================
// 2. ENDPOINTS DE MAESTRO DE BODEGAS Y SILOS (dbo.TCL_MaestroBodegas)
// =========================================================================
// GET /api/tablero-control/bodegas/maestro?puerto=BUENAVENTURA
router.get('/maestro', obtenerMaestroBodegas);

// POST /api/tablero-control/bodegas/maestro (Usa MaestroBodegaDTO + Joi)
router.post('/maestro', crearBodega);

// PUT /api/tablero-control/bodegas/maestro/:idBodega (Actualiza inventario/estado/temp)
router.put('/maestro/:idBodega', actualizarBodega);

// =========================================================================
// 3. ENDPOINTS DE MOVIMIENTOS Y LOTES BL (dbo.TCL_MovimientosBodega)
// =========================================================================
// GET /api/tablero-control/bodegas/movimientos?puerto=BUENAVENTURA
router.get('/movimientos', obtenerMovimientosBodega);

// Detalle de la vista ampliada (Fase 3): antes de '/:puerto'
// GET /api/tablero-control/bodegas/movimientos/rango?puerto=BUENAVENTURA&dias=30
router.get('/movimientos/rango', obtenerMovimientosRango);
// GET /api/tablero-control/bodegas/ocupacion?puerto=BUENAVENTURA&horas=24
router.get('/ocupacion', obtenerOcupacionBodegas);

// POST /api/tablero-control/bodegas/movimientos (Usa MovimientoBodegaDTO + Transacción SQL)
router.post('/movimientos', registrarMovimientoBodega);

// =========================================================================
// 4. FALLBACK POR PARÁMETRO DE RUTA (Ej: GET /api/tablero-control/bodegas/BUENAVENTURA)
// =========================================================================
router.get('/:puerto', obtenerDashboardBodegas);

module.exports = router;