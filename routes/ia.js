// ia.routes.js
const express = require('express');
const router = express.Router();
const iaAssistantController = require('../controllers/ia-assistant');

router.post('/ask', iaAssistantController.ask.bind(iaAssistantController));

module.exports = router;