/*
    Author: German Valencia
    Rutas de los dominios de la plataforma (OT-012). El contexto es público y de solo lectura: no revela usuarios ni permisos.
    Dominios de una aplicación (Aplicaciones › gestión, CC-202): con JWT y sesión; guardarlos = modificar la aplicación.
*/
const express = require('express');
const { validarJWT } = require('../../middlewares/validar-jwt');
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');
const Dominios = require('../../controllers/dominios/dominios.controller');

const router = express.Router();
router.get('/contexto', Dominios.contexto);
router.get('/aplicacion/:codigoAplicacion', [validarJWT, validarSesion], Dominios.dominiosDeAplicacion);
router.put('/aplicacion/:codigoAplicacion', [validarJWT, validarSesion, validarPermiso('ACT_APP_MODIFICAR')], Dominios.guardarDominiosDeAplicacion);

module.exports = router;
