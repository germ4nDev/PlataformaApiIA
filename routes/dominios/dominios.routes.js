/*
    Author: German Valencia
    Rutas de los dominios de la plataforma (OT-012). Públicas y de solo lectura: el contexto no revela usuarios ni permisos.
*/
const express = require('express');
const Dominios = require('../../controllers/dominios/dominios.controller');

const router = express.Router();
router.get('/contexto', Dominios.contexto);

module.exports = router;
