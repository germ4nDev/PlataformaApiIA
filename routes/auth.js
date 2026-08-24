/*
    Author: German Valencia
    Ruta: /api/auth
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  login,
  renewToken,
  verificarClaveActual,
  verificarUserInRole,
} = require("../controllers/auth");

const router = Router();

router.post("/", login);

router.post("/role", validarJWT, verificarUserInRole);

router.post("/compare", validarJWT, verificarClaveActual);

router.get("/renew", validarJWT, renewToken);

module.exports = router;
