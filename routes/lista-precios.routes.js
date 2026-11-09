const { Router } = require('express');
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");
const {
    getListas,
    createLista,
    updateLista,
    addDetalle,
    updateDetalle,
    deleteDetalle
} = require('../controllers/lista-precios.controller');
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

router.get('/', getListas);

router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_CREAR')], createLista);

router.put('/:id', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_MODIFICAR')], updateLista);

// ==========================================
// 🟢 RUTAS DE DETALLE (Precios de Paquetes/Items)
// ==========================================
router.post('/:codigoLista/detalles', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_CREAR')], addDetalle);

router.put('/detalles/:codigoDetalle', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_MODIFICAR')], updateDetalle);

router.delete('/detalles/:codigoDetalle', [validarJWT, validarSesion, validarPermiso('ACT_PRECIO_ELIMINAR')], deleteDetalle);

module.exports = router;