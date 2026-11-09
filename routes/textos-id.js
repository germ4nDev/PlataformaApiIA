/*
    Author: German Valencia
    Ruta: /api/textos-id
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getTextos,
  getTextoById,
  createTexto,
  updateTexto,
  deleteTexto
} = require("../controllers/textos-id");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTextos);

router.get("/:id", getTextoById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TEXTOS_CREAR')], createTexto);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TEXTOS_MODIFICAR')], updateTexto);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TEXTOS_ELIMINAR')], deleteTexto);

module.exports = router;