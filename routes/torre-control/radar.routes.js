const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");

const RadarController = require('../../controllers/torre-control/motonaves-radar.controller');

router.get('/naves', RadarController.obtenerCapaRadar);

module.exports = router;