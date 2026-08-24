const express = require('express');
const router = express.Router();
const { guardarTablero, obtenerTablero, obtenerTableroUsuario } = require('../../controllers/torre-control/layout.controller');

// Ruta para persistir el tablero (Wipe & Replace)
router.post('/guardar', guardarTablero);

// 🚀 RUTA PARA LEER EL TABLERO
router.get('/obtener/:codigo_usuario', obtenerTablero);

router.get('/tablero/:codigo_usuario/:tablero', obtenerTableroUsuario);

module.exports = router;