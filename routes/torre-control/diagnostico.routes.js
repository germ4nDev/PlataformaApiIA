const express = require('express');
const router = express.Router();
const diagnosticoController = require('../controllers/torre-control/diagnostico.controller');

// GET /api/diagnostico/estado-tuneles
router.get('/estado-tuneles', diagnosticoController.obtenerEstadoTuneles);

// POST /api/diagnostico/dry-run/eventos-viales
router.post('/dry-run/:tunel', diagnosticoController.ejecutarDryRun);

module.exports = router;