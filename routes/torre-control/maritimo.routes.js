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

// Todo /api/maritimo exige sesión (antes validarJWT se importaba pero no se aplicaba). PorttosCore reenvía el token.
router.use(validarJWT);
router.get('/operaciones-sla', MaritimoController.obtenerOperacionesSLA);

router.get('/lineup', MaritimoController.obtenerLineUp);

router.get('/clima', MaritimoController.obtenerClima);

router.get('/resumen', MaritimoController.obtenerResumenOperativo);

router.get('/mapa-posiciones', obtenerPosicionesMapa);

router.get('/capa-naves', obtenerPosicionesMapa);

router.get('/mapa-infraestructura', obtenerInfraestructuraMapa);

router.get('/posiciones', obtenerPosicionesAis);

// KPIs marítimos en vivo (estado AIS + avisos DIMAR). Dos segmentos: no chocan con /resumen ni /clima.
const MaritimoVivo = require('../../controllers/torre-control/maritimo-vivo.controller');
router.get('/:puerto/resumen', MaritimoVivo.obtenerResumenVivo);
router.get('/:puerto/tiempos', MaritimoVivo.obtenerTiemposVivo);
router.get('/:puerto/ocupacion', MaritimoVivo.obtenerOcupacionVivo);
router.get('/:puerto/muelles-estado', MaritimoVivo.obtenerEstadoMuellesVivo);
router.get('/:puerto/embudo', MaritimoVivo.obtenerEmbudoVivo);
router.get('/:puerto/llegadas', MaritimoVivo.obtenerLlegadasVivo);

module.exports = router;