const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');

// Todas las rutas de este módulo requieren usuario autenticado
router.use(validarJWT);
const EventoVialController = require('../../controllers/torre-control/evento-vial.controller');
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

// Este es el endpoint que consumirá Angular
router.get('/eventos', EventoVialController.getEventosActivos);
// Despeje manual (operador): el evento pasa a DESPEJADO con motivo MANUAL y sale del mapa
router.patch('/eventos/:codigo/despejar', [validarSesion, validarPermiso('ACT_EVENTOS_DESPEJAR')], EventoVialController.despejar);

module.exports = router;