/*
    Author: German Valencia
    Ruta: /api/idiomas
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getIdiomas,
  getIdiomaById,
  createIdioma,
  updateIdioma,
  deleteIdioma
} = require("../controllers/idiomas");

const router = Router();

// router.use(validarJWT);

router.get("/", getIdiomas);
router.get("/:id", getIdiomaById);

router.post("/", [
  check('nombreIdioma', 'El nombre del idioma es obligatorio').not().isEmpty(),
  validarJWT,
  validarCampos
], createIdioma);

router.put("/:id", [
  validarJWT,
  validarCampos
], updateIdioma);

router.delete("/:id", validarJWT, deleteIdioma);

module.exports = router;
