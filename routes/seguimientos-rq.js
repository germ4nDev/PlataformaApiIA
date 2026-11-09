/*
    Author: German Valencia
    Actualización: John Castañeda
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getSeguimientos,
    getSeguimientoById,
    getSeguimientosByTicket,
    createSeguimiento,
    updateSeguimiento,
    deleteSeguimiento
} = require("../controllers/seguimientos-rq");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getSeguimientos);

router.get("/:id", validarJWT, getSeguimientoById);

router.get("/ticket/:ticketId", validarJWT, getSeguimientosByTicket);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_SEGUIMIENTOS_CREAR')], createSeguimiento);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SEGUIMIENTOS_MODIFICAR')], updateSeguimiento);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SEGUIMIENTOS_ELIMINAR')], deleteSeguimiento);

module.exports = router;