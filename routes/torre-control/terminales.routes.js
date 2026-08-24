const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
// Asegúrate de que la ruta del require apunte correctamente a tu controlador
const {
  getTerminales,
  getTerminalById,
  crearTerminal,
  updateTerminal,
  deleteTerminal
} = require('../../controllers/torre-control/terminales.controller');

// Aquí es donde te estaba fallando (probablemente en el getTerminales o getTerminalById)
router.get('/', getTerminales);
router.get('/:id', getTerminalById);
router.post('/', crearTerminal);
router.put('/:id', updateTerminal);
router.delete('/:id', deleteTerminal);

module.exports = router;
