/*
    Author: German Valencia
    Refactored for: QPLUS Architecture & Strict Validations
    Ruta base recomendada: /api/layout
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarPermiso } = require('../middlewares/validar-permiso');
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getLayouts,
  getLayoutByUsuario,
  saveOrUpdateLayout,
  getPestanasUsuario,
  savePestanasUsuario
} = require("../controllers/layout.controller");

const router = Router();

// Módulo Layouts (Widgets)
router.get("/", getLayouts);
router.get("/user/:codigoUsuario/:codigoPestana", getLayoutByUsuario);
router.post("/", saveOrUpdateLayout); // Puedes habilitar validarJWT aquí si lo requieres

// Módulo Pestañas (Tabs)
router.get("/pestanas/user/:codigoUsuario", getPestanasUsuario);
router.post("/pestanas", savePestanasUsuario);

module.exports = router;