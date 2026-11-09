/*
    Author: German Valirncia
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getTiposItem,
  getTipoItemById,
  createTipoItem,
  updateTipoItem,
  deleteTipoItem
} = require("../controllers/tipos-item.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposItem);

router.get("/:id", getTipoItemById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOS_ITEM_CREAR')], createTipoItem);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOS_ITEM_MODIFICAR')], updateTipoItem);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOS_ITEM_ELIMINAR')], deleteTipoItem);

module.exports = router;