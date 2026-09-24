/*
    Author: German Valencia
    Pattern: PORTTOS Routes - Mapa General
*/
const express = require('express');
const router = express.Router();
const controller = require('../../controllers/torre-control/mapa-general.controller');

// 🟢 RUTAS DESACOPLADAS: Cada capa tiene su propio endpoint
// Estas apuntan a los métodos corregidos en mapa-general.controller.js
console.log("Controlador cargado:", Object.keys(controller));
router.get('/infraestructura', controller.obtenerCapaInfraestructura);
router.get('/terrestre', controller.obtenerCapaTerrestre);
router.get('/clima', controller.obtenerCapaClima);
router.get('/naves', controller.obtenerCapaNaves);
// if (process.env.NODE_ENV === 'development') {
router.get('/diagnostico-fuentes', controller.diagnosticarEsquemas);
// }

module.exports = router;