const express = require('express');
const router = express.Router();
const { validarJWT } = require('../../middlewares/validar-jwt');
const TablerosController = require('../../controllers/torre-control/tableros-pestanas.controller');

router.use(validarJWT);
router.get('/granel/:puerto', TablerosController.obtenerGranel);
router.get('/carga-suelta/:puerto', TablerosController.obtenerCargaSuelta);
router.get('/capacidad/:puerto', TablerosController.obtenerCapacidad);
router.get('/noticias/:puerto', TablerosController.obtenerNoticias);
// Detalle bajo demanda (vista ampliada)
router.get('/granel/:puerto/avance', TablerosController.obtenerAvanceGranel);
router.get('/capacidad/:puerto/serie', TablerosController.obtenerSerieNodo);
router.get('/noticias/:puerto/trm', TablerosController.obtenerTrm);

module.exports = router;
