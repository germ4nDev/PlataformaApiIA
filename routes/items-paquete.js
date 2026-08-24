/*
    Author: German Valencia
    Ruta: /api/idiomas
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getItemsPaquete,
  getItemPaqueteById,
  getItemsByPaqueteCode,
  createItemPaquete,
  updateItemPaquete,
  deleteItemPaquete
} = require("../controllers/items-paquete");

const router = Router();

router.use(validarJWT);

router.get("/", getItemsPaquete);
router.get("/:id", getItemPaqueteById);
router.get("/paquete/:codigoPaquete", getItemsByPaqueteCode);

router.post("/", [
  check('codigoItem', 'El código del ítem es obligatorio').not().isEmpty(),
  check('codigoPaquete', 'El código del paquete es obligatorio').not().isEmpty(),
  check('nombreItem', 'El nombre del ítem es obligatorio').not().isEmpty(),
  validarCampos
], createItemPaquete);

router.put("/:id", [
  validarCampos
], updateItemPaquete);

router.delete("/:id", deleteItemPaquete);

module.exports = router;