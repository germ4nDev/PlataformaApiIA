/*
    Author: German Valencia
    Rutas: /api/traducciones (Utilidades › Traducciones, OT-027). Las escrituras con token, sesión y su llave (regla 20).
*/
const { Router } = require('express');
const { validarJWT } = require('../middlewares/validar-jwt');
const { validarSesion } = require('../middlewares/validar-sesion');
const { validarPermiso } = require('../middlewares/validar-permiso');
const C = require('../controllers/plataforma/traducciones.controller');

const router = Router();

router.get('/', [validarJWT, validarSesion], C.getTraducciones);
router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_TRAD_CREAR')], C.crearTraduccion);
router.put('/', [validarJWT, validarSesion, validarPermiso('ACT_TRAD_MODIFICAR')], C.modificarTraduccion);
router.delete('/', [validarJWT, validarSesion, validarPermiso('ACT_TRAD_ELIMINAR')], C.eliminarTraduccion);
router.post('/:idioma/sembrar', [validarJWT, validarSesion, validarPermiso('ACT_TRAD_MODIFICAR')], C.sembrarIdioma);
// pública: la web la pide al arrancar, antes del login
router.get('/:idioma', C.getArbol);

module.exports = router;
