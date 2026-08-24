/*
    Author: German Valencia
    Ruta: /api/textos-id
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getTextos,
  getTextoById,
  createTexto,
  updateTexto,
  deleteTexto
} = require("../controllers/textos-id");

const router = Router();

router.use(validarJWT);

router.get("/", getTextos);
router.get("/:id", getTextoById);

router.post("/", [
  check('anclaTexto', 'El ancla del texto es obligatoria').not().isEmpty(),
  check('contenidoTexto', 'El contenido del texto es obligatorio').not().isEmpty(),
  validarCampos
], createTexto);

router.put("/:id", [
  validarCampos
], updateTexto);

router.delete("/:id", deleteTexto);

module.exports = router;