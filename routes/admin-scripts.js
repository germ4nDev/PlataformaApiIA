const { Router } = require('express');
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    ejecutarScript,
    ejecutarScriptMultiDb
} = require('../controllers/admin-scripts');
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();
// router.use(validarSesion);

router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_SCRIPTS_EJECUTAR')], ejecutarScript);

router.post('/multi/', [validarJWT, validarSesion, validarPermiso('ACT_SCRIPTS_EJECUTAR')], ejecutarScriptMultiDb);

module.exports = router;