/*
    Author: German Valencia
    Rutas de los dominios de la plataforma (OT-012). El contexto es público y de solo lectura: no revela usuarios ni permisos.
    Dominios de una aplicación (Aplicaciones › gestión, CC-202): con JWT y sesión; guardarlos = modificar la aplicación.
    Utilidades › Dominios (CC-224): lista y gestión con JWT y sesión; escribir con ACT_DOM_* (regla 20).
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
// CC-224: Utilidades › Dominios
router.get('/', [validarJWT, validarSesion], Dominios.listar);
router.get('/:id', [validarJWT, validarSesion], Dominios.obtener);
router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_DOM_CREAR')], Dominios.crear);
router.put('/:id', [validarJWT, validarSesion, validarPermiso('ACT_DOM_MODIFICAR')], Dominios.modificar);
router.delete('/:id', [validarJWT, validarSesion, validarPermiso('ACT_DOM_ELIMINAR')], Dominios.eliminar);

module.exports = router;
