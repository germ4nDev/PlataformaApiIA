/*
    Author: German Valencia
    Ruta: /api/items paquetes
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getModulosPaquete,
  getModulosPaqueteById,
  getModulosPaqueteByCode,
  createModulosPaquete,
  updateModulosPaquete,
  deleteModulosPaquete
} = require("../controllers/modulos-paquete.controller");

const router = Router();

router.use(validarJWT);

router.get("/", getModulosPaquete);

router.get("/:id", getModulosPaqueteById);

router.get("/paquete/:codigoPaquete", getModulosPaqueteByCode);

router.post("/", [
  check('codigoPaquete', 'El código del paquete es obligatorio').not().isEmpty(),
  check('modulos', 'El arreglo de módulos es obligatorio').isArray(),
  validarCampos
], createModulosPaquete);

router.put("/:id", [
  validarCampos
], updateModulosPaquete);

router.delete("/:id", deleteModulosPaquete);

module.exports = router;