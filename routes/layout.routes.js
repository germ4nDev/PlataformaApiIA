/*
    Author: German Valencia
    Refactored for: QPLUS Architecture & Strict Validations
    Ruta: /api/layout
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarPermiso } = require('../middlewares/validar-permiso');

const {
  getLayoutByUsuario,
  saveOrUpdateLayout
} = require("../controllers/layout.controller");

const router = Router();

// Opcional: Proteger las rutas con JWT si ya lo tienes implementado
// router.use(validarJWT);

router.get("/:codigoUsuario", getLayoutByUsuario);

router.post("/", saveOrUpdateLayout);

module.exports = router;