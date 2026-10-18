/*
    Author: German Valencia
    Pattern: PORTTOS Routes Pattern - Contenedores
*/
const { Router } = require('express');
const { getDashboardContenedores } = require('../../controllers/torre-control/contenedores.controller');

const router = Router();
const { validarJWT } = require('../../middlewares/validar-jwt');

// Todas las rutas de este módulo requieren usuario autenticado
router.use(validarJWT);

// GET: /api/torre-control/contenedores
router.get('/', getDashboardContenedores);

module.exports = router;