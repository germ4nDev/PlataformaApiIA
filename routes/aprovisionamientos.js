/*
    OT-030: estado de las bases de cada suscriptor (una por aplicación de su paquete) y reintento. Detalle en
    controllers/plataforma/aprovisionamiento.controller.js.
*/
const { Router } = require('express');
const { validarJWT } = require('../middlewares/validar-jwt');
const { validarSesion } = require('../middlewares/validar-sesion');
const { validarPermiso } = require('../middlewares/validar-permiso');
const C = require('../controllers/plataforma/aprovisionamiento.controller');

const router = Router();

router.get('/', [validarJWT, validarSesion], C.getAprovisionamientos);
router.post('/reintentar', [validarJWT, validarSesion, validarPermiso('ACT_SUSCPAQ_MODIFICAR')], C.reintentar);

module.exports = router;
