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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTextos);

router.get("/:id", getTextoById);

router.post("/", [validarJWT, validarSesion], createTexto);

router.put("/:id", [validarJWT, validarSesion], updateTexto);

router.delete("/:id", [validarJWT, validarSesion], deleteTexto);

module.exports = router;