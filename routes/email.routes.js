const { Router } = require('express');
const { enviarClave, enviarNuevaClave } = require('../controllers/email.controller');

const router = Router();

router.post('/enviar-clave', enviarClave);
router.post('/cambiar-clave', enviarNuevaClave);

module.exports = router;