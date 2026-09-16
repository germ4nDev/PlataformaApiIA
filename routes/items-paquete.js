/*
    Author: German Valencia
    Ruta: /api/idiomas
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getItemsPaquete,
  getItemPaqueteById,
  getItemsByPaqueteCode,
  createItemPaquete,
  updateItemPaquete,
  deleteItemPaquete
} = require("../controllers/items-paquete");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getItemsPaquete);

router.get("/:id", getItemPaqueteById);

router.get("/paquete/:codigoPaquete", getItemsByPaqueteCode);

router.post("/", [validarJWT, validarSesion], createItemPaquete);

router.put("/:id", [validarJWT, validarSesion], updateItemPaquete);

router.delete("/:id", [validarJWT, validarSesion], deleteItemPaquete);

module.exports = router;