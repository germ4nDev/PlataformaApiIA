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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getModulosPaquete);

router.get("/:id", getModulosPaqueteById);

router.get("/paquete/:codigoPaquete", getModulosPaqueteByCode);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_MODPQ_CREAR')], createModulosPaquete);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_MODPQ_MODIFICAR')], updateModulosPaquete);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_MODPQ_ELIMINAR')], deleteModulosPaquete);

module.exports = router;