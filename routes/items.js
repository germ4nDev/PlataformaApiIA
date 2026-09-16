/*
    Author: German Valencia
    Ruta: /api/idiomas
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem
} = require("../controllers/items");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getItems);

router.get("/:id", getItemById);

router.post("/", [validarJWT, validarSesion], createItem);

router.put("/:id", [validarJWT, validarSesion], updateItem);

router.delete("/:id", [validarJWT, validarSesion], deleteItem);

module.exports = router;