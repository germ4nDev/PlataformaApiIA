const { Router } = require('express');
const { getLayoutByUsuario, saveOrUpdateLayout } = require('../controllers/usuarios-widgets.controller');
const { validarSesion } = require("../middlewares/validar-sesion");
const { validarJWT } = require("../middlewares/validar-jwt");

const router = Router();
// router.use(validarSesion);

router.get('/:codigoUsuario', getLayoutByUsuario);

router.post('/', [validarJWT, validarSesion], saveOrUpdateLayout);

module.exports = router;