/*
    Author: John Castañeda
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getEstados,
    getEstadoById,
    createEstado,
    updateEstado,
    deleteEstado
} = require("../controllers/estados");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getEstados);

router.get("/:id", getEstadoById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_ESTADOS_CREAR')], createEstado);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ESTADOS_MODIFICAR')], updateEstado);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ESTADOS_ELIMINAR')], deleteEstado);

module.exports = router;