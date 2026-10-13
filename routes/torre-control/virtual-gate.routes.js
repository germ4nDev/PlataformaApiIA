const express = require('express');
const router = express.Router();
const virtualGateController = require('../../controllers/torre-control/virtual-gate.controller');

// Responde a GET /api/torre-control/virtual-gate y GET /api/virtual-gate
router.get('/', (req, res) => virtualGateController.obtenerResumenVirtualGate(req, res));
router.get('/cola-gate', (req, res) => virtualGateController.obtenerResumenVirtualGate(req, res));

module.exports = router;