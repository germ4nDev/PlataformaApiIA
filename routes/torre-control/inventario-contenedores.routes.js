/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/inventario-contenedores
*/
const { Router } = require("express");
const { validarJWT } = require("../../middlewares/validar-jwt");
const { validarPermiso } = require('../../middlewares/validar-permiso');
const { validarSesion } = require("../../middlewares/validar-sesion");

const {
  getInventarios,
  getInventarioById,
  createInventario,
  updateInventario,
  uploadMasivoInventario,
  deleteInventario
} = require("../../controllers/torre-control/inventario-contenedores.controller");

const router = Router();

router.get("/", getInventarios);

router.get("/:id", getInventarioById);

router.post('/cargue-masivo', [
  validarJWT,
  validarSesion,
  validarPermiso('ACT_INV_CARGUE')
], uploadMasivoInventario);

router.post("/", [
  validarJWT,
  validarSesion,
  validarPermiso('ACT_INV_CREAR')
], createInventario);

router.put("/:id", [
  validarJWT,
  validarSesion,
  validarPermiso('ACT_INV_ACTUALIZAR')
], updateInventario);

router.delete("/:id", [
  validarJWT,
  validarSesion,
  validarPermiso('ACT_INV_ELIMINAR')
], deleteInventario);

module.exports = router;