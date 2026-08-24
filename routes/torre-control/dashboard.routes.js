// routes/dashboard.routes.js
const { Router } = require('express');
const { validarJWT } = require('../../middlewares/validar-jwt');
const { getDashboardLayout, saveDashboardLayout } = require('../../controllers/torre-control/dashboard.controller');
const { obtenerMapaFormatoFrontend } = require('../../controllers/torre-control/mapa-portuario.controller');
const { obtenerClimaPuerto, obtenerClimaPuertoRuta } = require('../../controllers/torre-control/clima.controller');
const { obtenerReportes, crearReporteOperativo } = require('../../controllers/torre-control/reportes.controller');
const { getProductividadGrafica } = require('../../controllers/torre-control/productividad-chart.controller');
const { navesController } = require('../../controllers/torre-control/naves-avisadas.controller');

const router = Router();

// Envolvemos todo para que Node no evalúe si son 'undefined' hasta que la ruta sea visitada
router.get('/productividad-grafica', [validarJWT], (req, res) => getProductividadGrafica(req, res));

router.get('/reportes-operativos', [validarJWT], (req, res) => obtenerReportes(req, res));

router.get('/puertos', (req, res) => obtenerMapaFormatoFrontend(req, res));

router.get('/clima', [validarJWT], (req, res) => obtenerClimaPuerto(req, res));

router.get('/:codigoTablero', [validarJWT], (req, res) => getDashboardLayout(req, res));

router.post('/', [validarJWT], (req, res) => saveDashboardLayout(req, res));

router.get('/canales/:puerto', [validarJWT], (req, res) => obtenerClimaPuertoRuta(req, res));

router.post('/reportes-operativos/:puerto', [validarJWT], (req, res) => crearReporteOperativo(req, res));

module.exports = router;