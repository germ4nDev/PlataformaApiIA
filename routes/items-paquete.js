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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getItemsPaquete);

router.get("/:id", getItemPaqueteById);

router.get("/paquete/:codigoPaquete", getItemsByPaqueteCode);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_ITEMPQ_CREAR')], createItemPaquete);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ITEMPQ_MODIFICAR')], updateItemPaquete);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ITEMPQ_ELIMINAR')], deleteItemPaquete);

module.exports = router;