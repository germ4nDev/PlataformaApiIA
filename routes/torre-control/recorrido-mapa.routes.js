const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');
const RecorridoMapaController = require('../../controllers/torre-control/recorrido-mapa.controller');

router.use(validarJWT);
router.get('/:puerto', RecorridoMapaController.obtenerRecorrido);

module.exports = router;
