/*
    Author: German Valencia
    Refactored for: PORTTOS Standard - Router de Infraestructura
*/
const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const {
  getInfraestructuras,
  getInfraestructuraById,
  crearInfraestructura,
  updateInfraestructura,
  deleteInfraestructura
} = require("../../controllers/torre-control/infraestructura.controller");
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

router.get('/', getInfraestructuras);

// CORRECCIÓN: Cambiamos :id por :id_infraestructura para que coincida con el controlador
router.get('/:id', [validarJWT], getInfraestructuraById);

router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_INFRA_CREAR')], crearInfraestructura);

// CORRECCIÓN: Actualizamos también aquí
router.put('/:id', [validarJWT, validarSesion, validarPermiso('ACT_INFRA_MODIFICAR')], updateInfraestructura);

// CORRECCIÓN: Actualizamos también aquí
router.delete('/:id', [validarJWT, validarSesion, validarPermiso('ACT_INFRA_ELIMINAR')], deleteInfraestructura);

module.exports = router;