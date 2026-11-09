/*
    Author: German Valencia
    Actualización: John Castañeda
    Ruta: /api/tickets
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getTickets,
    getTicketById,
    createTicket,
    updateTicket,
    deleteTicket
} = require("../controllers/tickets-ap");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTickets);

router.get("/:id", getTicketById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TICKETS_CREAR')], createTicket);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TICKETS_MODIFICAR')], updateTicket);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TICKETS_ELIMINAR')], deleteTicket);

module.exports = router;