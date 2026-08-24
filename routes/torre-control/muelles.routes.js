const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const {
  getMuelles,
  getMuelleById,
  crearMuelle,
  updateMuelle,
  deleteMuelle
} = require("../../controllers/torre-control/muelle.controller");

router.get('/', getMuelles);

router.get('/:id', [validarJWT], getMuelleById);

router.post('/', [validarJWT], crearMuelle);

router.put('/:id', updateMuelle);

router.delete('/:id', [validarJWT], deleteMuelle);

module.exports = router;
