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

const router = Router();

router.get('/', getListas);

router.post('/', [validarJWT, validarSesion], createLista);

router.put('/:id', [validarJWT, validarSesion], updateLista);

// ==========================================
// 🟢 RUTAS DE DETALLE (Precios de Paquetes/Items)
// ==========================================
router.post('/:codigoLista/detalles', [validarJWT, validarSesion], addDetalle);

router.put('/detalles/:codigoDetalle', [validarJWT, validarSesion], updateDetalle);

router.delete('/detalles/:codigoDetalle', [validarJWT, validarSesion], deleteDetalle);

module.exports = router;