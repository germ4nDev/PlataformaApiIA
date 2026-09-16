// ia.routes.js
const express = require('express');
const router = express.Router();
const iaAssistantController = require('../controllers/ia-assistant');
const { validarSesion } = require("../middlewares/validar-sesion");
router.use(validarSesion);

router.post('/ask', iaAssistantController.ask.bind(iaAssistantController));

module.exports = router;