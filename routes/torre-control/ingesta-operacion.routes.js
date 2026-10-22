const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');
const IngestaOperacionController = require('../../controllers/torre-control/ingesta-operacion.controller');

router.use(validarJWT);
router.post('/:tipo', IngestaOperacionController.ingerir);

module.exports = router;
