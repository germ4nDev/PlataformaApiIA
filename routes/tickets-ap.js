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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTickets);

router.get("/:id", getTicketById);

router.post("/", [validarJWT, validarSesion], createTicket);

router.put("/:id", [validarJWT, validarSesion], updateTicket);

router.delete("/:id", [validarJWT, validarSesion], deleteTicket);

module.exports = router;