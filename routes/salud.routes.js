/*
    Author: German Valencia
    Rutas: latido de la plataforma (CC-279). Sin sesión y sin datos: la web la consulta cada 30 s para saber si el API responde.
      GET /api/salud → { ok, hora, bd: { ok, ms, revisadaEn } }   (la base se revisa como mucho cada 20 s, con tope de 3 s)
*/
const express = require('express');
const { latido } = require('../controllers/salud.controller');

const router = express.Router();
router.get('/', latido);

module.exports = router;
