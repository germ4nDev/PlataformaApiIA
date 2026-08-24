/*
    Author: German Valirncia
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getTiposItem,
  getTipoItemById,
  createTipoItem,
  updateTipoItem,
  deleteTipoItem
} = require("../controllers/tipos-item");

const router = Router();

router.use(validarJWT);

router.get("/", getTiposItem);
router.get("/:id", getTipoItemById);

router.post("/", [
  check('nombreTipo', 'El nombre del tipo es obligatorio').not().isEmpty(),
  validarCampos
], createTipoItem);

router.put("/:id", [
  validarCampos
], updateTipoItem);

router.delete("/:id", deleteTipoItem);

module.exports = router;