const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');
const AlertasMapaController = require('../../controllers/torre-control/alertas-mapa.controller');

router.use(validarJWT);
router.get('/', AlertasMapaController.obtenerBitacora);
router.get('/reglas', AlertasMapaController.listarReglas);
router.put('/reglas', AlertasMapaController.guardarRegla);
router.delete('/reglas/:codigo/:puerto', AlertasMapaController.eliminarRegla);

module.exports = router;
