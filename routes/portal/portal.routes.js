/*
    Author: German Valencia
    Rutas del portal público porttos.co (sin JWT: es la página pública). Solo lectura, más el formulario de Contáctenos,
    que el servicio limita a 5 mensajes por hora por origen. La administración de contenidos va en la plataforma (fase 2).
*/
const express = require('express');
const Portal = require('../../controllers/portal/portal.controller');

const router = express.Router();

router.get('/config', Portal.config);
router.get('/paginas/:pagina', Portal.pagina);
router.get('/planes', Portal.planes);
router.get('/preguntas/:pagina', Portal.preguntas);
router.post('/mensajes', express.json({ limit: '16kb' }), Portal.mensaje);
router.get('/puertos-en-vivo', Portal.puertos);
router.get('/puertos-en-vivo/:puerto', Portal.puertoEnVivo);

module.exports = router;
