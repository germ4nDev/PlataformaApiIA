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
} = require("../controllers/tipos-item");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposItem);

router.get("/:id", getTipoItemById);

router.post("/", [validarJWT, validarSesion], createTipoItem);

router.put("/:id", [validarJWT, validarSesion], updateTipoItem);

router.delete("/:id", [validarJWT, validarSesion], deleteTipoItem);

module.exports = router;