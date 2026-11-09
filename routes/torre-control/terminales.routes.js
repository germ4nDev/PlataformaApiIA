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
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

// Aquí es donde te estaba fallando (probablemente en el getTerminales o getTerminalById)
router.get('/', getTerminales);
router.get('/:id', getTerminalById);
router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_TERMINALES_CREAR')], crearTerminal);
router.put('/:id', [validarJWT, validarSesion, validarPermiso('ACT_TERMINALES_MODIFICAR')], updateTerminal);
router.delete('/:id', [validarJWT, validarSesion, validarPermiso('ACT_TERMINALES_ELIMINAR')], deleteTerminal);

module.exports = router;
