/*
    Author: German Valencia
    Rutas de la app móvil (PorttosMovil). Todas con JWT y sesión activa (x-sesion-id).
*/
const express = require('express');
const { validarJWT } = require('../../middlewares/validar-jwt');
const { validarSesion } = require('../../middlewares/validar-sesion');
const Movil = require('../../controllers/movil/tablero-movil.controller');
const Dispositivos = require('../../controllers/movil/dispositivos.controller');
const MapaMovil = require('../../controllers/movil/mapa-movil.controller');

const router = express.Router();
router.use(validarJWT, validarSesion);

// Fase 2: tablero móvil
router.get('/tablero/:puerto/:pestana', Movil.obtenerTablero);

// Fase 3: notificaciones push
router.get('/dispositivos', Dispositivos.misDispositivos);
router.post('/dispositivos', Dispositivos.registrar);
router.post('/dispositivos/baja', Dispositivos.baja);
router.post('/dispositivos/prueba', Dispositivos.probar);

// Fase 4: mapa logístico
router.get('/mapa/:puerto', MapaMovil.obtenerMapa);

module.exports = router;
