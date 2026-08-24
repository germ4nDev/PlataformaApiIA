const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const {
  getFaros,
  getFaroById,
  crearFaro,
  updateFaro,
  deleteFaro
} = require("../../controllers/torre-control/faro.controller");

router.get('/', getFaros);

router.get('/:id', [validarJWT], getFaroById);

router.post('/', [validarJWT], crearFaro);

router.put('/:id', [validarJWT], updateFaro);

router.delete('/:id', [validarJWT], deleteFaro);

module.exports = router;
