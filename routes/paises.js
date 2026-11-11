/*
    Utilidades › Países (código ISO, moneda y demás datos de los países que usa la plataforma; Listas de precios los usa).
*/
const { Router } = require('express');
const { validarJWT } = require('../middlewares/validar-jwt');
const { validarSesion } = require('../middlewares/validar-sesion');
const { validarPermiso } = require('../middlewares/validar-permiso');
const C = require('../controllers/plataforma/paises.controller');

const router = Router();

router.get('/', [validarJWT, validarSesion], C.getPaises);
router.get('/:codigoPais', [validarJWT, validarSesion], C.getPais);
router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_PAIS_CREAR')], C.crearPais);
router.put('/:codigoPais', [validarJWT, validarSesion, validarPermiso('ACT_PAIS_MODIFICAR')], C.modificarPais);
router.delete('/:codigoPais', [validarJWT, validarSesion, validarPermiso('ACT_PAIS_ELIMINAR')], C.eliminarPais);

module.exports = router;
