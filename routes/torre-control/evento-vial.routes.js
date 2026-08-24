const express = require('express');
const router = express.Router();
const EventoVialController = require('../../controllers/torre-control/evento-vial.controller');

// Este es el endpoint que consumirá Angular
router.get('/eventos', EventoVialController.getEventosActivos);

module.exports = router;