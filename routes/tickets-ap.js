/*
    Author: German Valencia
    Actualización: John Castañeda
    Ruta: /api/tickets
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getTickets,
    getTicketById,
    createTicket,
    updateTicket,
    deleteTicket
} = require("../controllers/tickets-ap");

const router = Router();

router.use(validarJWT);

router.get("/", getTickets);
router.get("/:id", getTicketById);

router.post("/", [
    check('nombreTicket', 'El nombre del ticket es obligatorio').not().isEmpty(),
    check('descripcionTicket', 'La descripción es obligatoria').not().isEmpty(),
    validarCampos
], createTicket);

router.put("/:id", [
    validarCampos
], updateTicket);

router.delete("/:id", deleteTicket);

module.exports = router;