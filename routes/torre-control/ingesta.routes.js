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
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

router.post('/rndc', [validarJWT, validarSesion, validarPermiso('ACT_INGESTA_CARGAR')], cargarRNDC);
router.post('/maritimo', [validarJWT, validarSesion, validarPermiso('ACT_INGESTA_CARGAR')], cargarMaritimo);
router.post('/matriz', [validarJWT, validarSesion, validarPermiso('ACT_INGESTA_CARGAR')], cargarMatrizOperaciones);
router.post('/historico-supertransporte/sincronizar', [
  validarJWT,
  validarSesion,
  validarPermiso('ACT_INGESTA_CARGAR')
], sincronizarSupertransporte);

router.post('/lineup/ingesta', [validarJWT, validarSesion, validarPermiso('ACT_INGESTA_CARGAR')], cargarLineUp);

module.exports = router;