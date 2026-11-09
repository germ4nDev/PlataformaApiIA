/*
    Author: German Valencia
    Rutas del layout del teléfono (OT-017 fase 2, migración 031). Todas con JWT y sesión activa.
    Ruta propia de Porttos: /api/layout (compartido) no se toca (regla 7).
*/
const express = require('express');
const { validarJWT } = require('../../middlewares/validar-jwt');
const { validarSesion } = require('../../middlewares/validar-sesion');
const LayoutTelefono = require('../../controllers/layout-telefono/layout-telefono.controller');

const router = express.Router();
router.use(validarJWT, validarSesion);

router.get('/', LayoutTelefono.pestanas);
router.get('/:pestana', LayoutTelefono.obtener);
router.put('/:pestana', LayoutTelefono.guardar);
router.delete('/:pestana', LayoutTelefono.restablecer);

module.exports = router;
