/*
    Author: German Valencia
    Ruta: /api/auth
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  login,
  renewToken,
  verificarClaveActual,
  verificarUserInRole,
} = require("../controllers/auth.controller");

const router = Router();

router.post("/", login);

router.post("/role", [validarJWT, validarSesion], verificarUserInRole);

router.post("/compare", [validarJWT, validarSesion], verificarClaveActual);

router.get("/renew", [validarJWT, validarSesion], renewToken);

module.exports = router;
