/*
    Author: German Valencia
    Ruta: /api/idiomas
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem
} = require("../controllers/items");

const router = Router();

router.use(validarJWT);

router.get("/", getItems);
router.get("/:id", getItemById);

router.post("/", [
  check('nombreItem', 'El nombre es obligatorio').not().isEmpty(),
  check('valorUnitario', 'El valor unitario es obligatorio').isNumeric(),
  validarCampos
], createItem);

router.put("/:id", [
  validarCampos
], updateItem);

router.delete("/:id", deleteItem);

module.exports = router;