/*
    Author: German Valencia
    Refactored for: QPLUS Architecture & REST Standardization
*/
const { Router } = require('express');
const { validarSesion } = require("../middlewares/validar-sesion");
const { validarJWT } = require("../middlewares/validar-jwt");

const {
  getWidgetsActivos,
  getWidgetById,
  createWidget,
  updateWidget,
  deleteWidget
} = require('../controllers/widgets.controller');

const router = Router();
// router.use(validarSesion);

// ==========================================
// RUTAS DE WIDGETS
// ==========================================
router.get('/activos', getWidgetsActivos);

router.get('/:id', getWidgetById);

router.post('/', [validarJWT, validarSesion], createWidget);

router.put('/:id', [validarJWT, validarSesion], updateWidget);

router.delete('/:id', [validarJWT, validarSesion], deleteWidget);

module.exports = router;