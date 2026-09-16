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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getSeguimientos);

router.get("/:id", validarJWT, getSeguimientoById);

router.get("/ticket/:ticketId", validarJWT, getSeguimientosByTicket);

router.post("/", [validarJWT, validarSesion], createSeguimiento);

router.put("/:id", [validarJWT, validarSesion], updateSeguimiento);

router.delete("/:id", [validarJWT, validarSesion], deleteSeguimiento);

module.exports = router;