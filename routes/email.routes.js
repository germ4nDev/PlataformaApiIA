const { Router } = require('express');
const { enviarClave, enviarNuevaClave } = require('../controllers/email.controller');
const { validarSesion } = require("../middlewares/validar-sesion");
const { validarJWT } = require("../middlewares/validar-jwt");

const router = Router();
// router.use(validarSesion);

router.post('/enviar-clave', [validarJWT, validarSesion], enviarClave);
router.post('/cambiar-clave', [validarJWT, validarSesion], enviarNuevaClave);

module.exports = router;