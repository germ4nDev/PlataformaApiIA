/*
    Author: German Valencia
    Refactored for: QPLUS Architecture & REST Standardization
*/
const { Router } = require('express');
const {
  getWidgetsActivos,
  getWidgetById,
  createWidget,
  updateWidget,
  deleteWidget
} = require('../controllers/widgets.controller');

const router = Router();

// ==========================================
// RUTAS DE WIDGETS
// ==========================================
router.get('/activos', getWidgetsActivos);
router.get('/:id', getWidgetById);
router.post('/', createWidget);
router.put('/:id', updateWidget);
router.delete('/:id', deleteWidget);

module.exports = router;