const { Router } = require('express');
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    ejecutarScript,
    ejecutarScriptMultiDb
} = require('../controllers/admin-scripts');

const router = Router();
// router.use(validarSesion);

router.post('/', [validarJWT, validarSesion], ejecutarScript);

router.post('/multi/', [validarJWT, validarSesion], ejecutarScriptMultiDb);

module.exports = router;