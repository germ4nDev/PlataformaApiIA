/*
    Author: John Castañeda
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getTiposEstados,
    getTipoEstadoById,
    createTipoEstado,
    updateTipoEstado,
    deleteTipoEstado
} = require("../controllers/tipos-estados");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposEstados);

router.get("/:id", getTipoEstadoById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSEST_CREAR')], createTipoEstado);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSEST_MODIFICAR')], updateTipoEstado);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSEST_ELIMINAR')], deleteTipoEstado);

module.exports = router;