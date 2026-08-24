const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const {
  getPuertos,
  getPuertoById,
  crearPuerto,
  updatePuerto,
  deletePuerto
} = require("../../controllers/torre-control/puertos.controller");

router.get('/', getPuertos);

router.get('/:id', [validarJWT], getPuertoById);

router.post('/', [validarJWT], crearPuerto);

router.put('/:id', [validarJWT], updatePuerto);

router.delete('/:id', [validarJWT], deletePuerto);

module.exports = router;
