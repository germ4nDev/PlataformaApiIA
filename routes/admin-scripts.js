const { Router } = require('express');
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    ejecutarScript,
    ejecutarScriptMultiDb
} = require('../controllers/admin-scripts');

const router = Router();

router.post('/', validarJWT, ejecutarScript);

router.post('/multi/', validarJWT, ejecutarScriptMultiDb);

module.exports = router;