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
} = require("../controllers/items.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getItems);

router.get("/:id", getItemById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_ITEMS_CREAR')], createItem);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ITEMS_MODIFICAR')], updateItem);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ITEMS_ELIMINAR')], deleteItem);

module.exports = router;