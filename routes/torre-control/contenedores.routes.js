/*
    Author: German Valencia
    Pattern: PORTTOS Routes Pattern - Contenedores
*/
const { Router } = require('express');
const { getDashboardContenedores } = require('../../controllers/torre-control/contenedores.controller');

const router = Router();

// GET: /api/torre-control/contenedores
router.get('/', getDashboardContenedores);

module.exports = router;