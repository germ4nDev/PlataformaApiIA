const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const {
  getTipoInfraestructuraes,
  getTipoInfraestructuraById,
  crearTipoInfraestructura,
  updateTipoInfraestructura,
  deleteTipoInfraestructura
} = require("../../controllers/torre-control/tipos-infraestructura.controller");

router.get('/', getTipoInfraestructuraes);

router.get('/:id', [validarJWT], getTipoInfraestructuraById);

router.post('/', [validarJWT], crearTipoInfraestructura);

router.put('/:id', [validarJWT], updateTipoInfraestructura);

router.delete('/:id', [validarJWT], deleteTipoInfraestructura);

module.exports = router;
