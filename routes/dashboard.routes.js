// dashboard.routes.js
const { Router } = require('express');
const dashboardController = require('./../controllers/dashboard.controller');
const { validarSesion } = require("../middlewares/validar-sesion");
const { validarJWT } = require('../middlewares/validar-jwt'); // Opcional si proteges las rutas con auth

const router = Router();
// router.use(validarSesion);

// Endpoints del Dashboard
router.get('/usuarios-conectados', dashboardController.obtenerUsuariosConectados);
router.get('/paquetes-suscriptor', dashboardController.obtenerPaquetesPorSuscriptor);
router.get('/resumen-tickets', dashboardController.obtenerResumenTickets);
router.get('/kpi-totales', dashboardController.obtenerKpiTotales);

router.get('/grafica-paquetes', dashboardController.obtenerPaquetesPorSuscriptor);
router.get('/grafica-tickets', dashboardController.obtenerResumenTickets);
router.get('/grafica-facturacion', dashboardController.obtenerFacturacionMRR);

module.exports = router;