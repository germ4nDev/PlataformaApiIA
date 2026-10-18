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

// Seguridad 2026-10-17: antes era público (exponía todas las geocercas y peajes sin sesión).
// El front solo lo llama con sesión iniciada (AppComponent.loadProtectedData y el mapa).
router.get('/', [validarJWT], getFaros);

router.get('/:id', [validarJWT], getFaroById);

router.post('/', [validarJWT], crearFaro);

router.put('/:id', [validarJWT], updateFaro);

router.delete('/:id', [validarJWT], deleteFaro);

module.exports = router;
