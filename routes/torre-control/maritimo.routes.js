const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");

const
  MaritimoController
    = require('../../controllers/torre-control/maritimo.controller');

const { obtenerPosicionesMapa, obtenerInfraestructuraMapa, obtenerPosicionesAis } = require('../../controllers/torre-control/maritimo.controller');

// ==========================================
// 🚨 DEBUG: ESTO NOS DIRÁ LA VERDAD 🚨
// ==========================================
// console.log("\n\n=== ¿QUÉ ESTÁ VIENDO NODE.JS? ===");
// console.log("Contenido del Controlador:", MaritimoController);
// console.log("=================================\n\n");

router.get('/operaciones-sla', MaritimoController.obtenerOperacionesSLA);

router.get('/lineup', MaritimoController.obtenerLineUp);

router.get('/clima', MaritimoController.obtenerClima);

router.get('/resumen', MaritimoController.obtenerResumenOperativo);

router.get('/mapa-posiciones', obtenerPosicionesMapa);

router.get('/capa-naves', obtenerPosicionesMapa);

router.get('/mapa-infraestructura', obtenerInfraestructuraMapa);

router.get('/posiciones', obtenerPosicionesAis);

module.exports = router;