/*
    Listas de precios (OT-029): única fuente del precio de venta de paquetes e items. Detalle en controllers/plataforma/listas-precios.controller.js.
    Las rutas fijas (vigente, cotizar, paquete, detalles) van antes de /:codigoLista.
*/
const { Router } = require('express');
const { validarJWT } = require('../middlewares/validar-jwt');
const { validarSesion } = require('../middlewares/validar-sesion');
const { validarPermiso } = require('../middlewares/validar-permiso');
const C = require('../controllers/plataforma/listas-precios.controller');

const router = Router();
const leer = [validarJWT, validarSesion];

router.get('/', leer, C.getListas);
router.get('/vigente', leer, C.getVigente);
router.get('/cotizar', leer, C.getCotizacion);
router.get('/paquete/:codigoPaquete', leer, C.getReferenciaPaquete);
router.put('/detalles/:codigoDetalle', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_MODIFICAR')], C.modificarPrecio);
router.delete('/detalles/:codigoDetalle', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_ELIMINAR')], C.eliminarPrecio);
router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_CREAR')], C.crearLista);
router.get('/:codigoLista', leer, C.getLista);
router.put('/:codigoLista', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_MODIFICAR')], C.modificarLista);
router.post('/:codigoLista/duplicar', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_CREAR')], C.duplicarLista);
router.post('/:codigoLista/detalles', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_CREAR')], C.agregarPrecio);

module.exports = router;
