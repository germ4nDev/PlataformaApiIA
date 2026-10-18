const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');

// Todas las rutas de este módulo requieren usuario autenticado
router.use(validarJWT);
const virtualGateController = require('../../controllers/torre-control/virtual-gate.controller');

// Responde a GET /api/torre-control/virtual-gate y GET /api/virtual-gate
router.get('/', (req, res) => virtualGateController.obtenerResumenVirtualGate(req, res));
router.get('/cola-gate', (req, res) => virtualGateController.obtenerResumenVirtualGate(req, res));

module.exports = router;