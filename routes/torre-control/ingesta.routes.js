const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");

const {
  cargarRNDC,
  cargarMaritimo,
  cargarMatrizOperaciones,
  sincronizarSupertransporte
} = require('../../controllers/torre-control/ingesta.controller');
const {
  consultarLineUp,
  cargarLineUp
} = require('../../controllers/torre-control/line-up-maritimo.controller');

router.post('/rndc', validarJWT, cargarRNDC);
router.post('/maritimo', validarJWT, cargarMaritimo);
router.post('/matriz', validarJWT, cargarMatrizOperaciones);
router.post('/historico-supertransporte/sincronizar', sincronizarSupertransporte);

router.post('/lineup/ingesta', validarJWT, cargarLineUp);

module.exports = router;