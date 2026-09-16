/*
    Author: German Valencia
    Ruta: /api/items paquetes
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getModulosPaquete,
  getModulosPaqueteById,
  getModulosPaqueteByCode,
  createModulosPaquete,
  updateModulosPaquete,
  deleteModulosPaquete
} = require("../controllers/modulos-paquete.controller");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getModulosPaquete);

router.get("/:id", getModulosPaqueteById);

router.get("/paquete/:codigoPaquete", getModulosPaqueteByCode);

router.post("/", [validarJWT, validarSesion], createModulosPaquete);

router.put("/:id", [validarJWT, validarSesion], updateModulosPaquete);

router.delete("/:id", [validarJWT, validarSesion], deleteModulosPaquete);

module.exports = router;