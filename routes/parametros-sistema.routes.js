/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/parametros
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarPermiso } = require('../middlewares/validar-permiso');
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getParametros,
  getParametroByCodigo,
  createParametro,
  updateParametro,
  deleteParametro
} = require("../controllers/parametros-sistema.controller");

const router = Router();

// 🟢 Obtener todos los parámetros
router.get("/", getParametros);

// 🟢 Obtener un parámetro específico
router.get("/:id", getParametroByCodigo);

// 🟢 Crear un nuevo parámetro  , validarPermiso('ACT_SYST_CREAR') , validarPermiso('ACT_SYST_ACTUALIZAR') , validarPermiso('ACT_SYST_ELIMINAR')
router.post("/", [validarJWT, validarSesion
], createParametro);

// 🟢 Actualizar un parámetro existente
router.put("/:id", [validarJWT, validarSesion
], updateParametro);

// 🟢 Eliminar un parámetro
router.delete("/:id", [validarJWT, validarSesion
], deleteParametro);

module.exports = router;