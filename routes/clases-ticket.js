const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getClasesTickets,
    getClaseTicketById,
    createClaseTicket,
    updateClaseTicket,
    deleteClaseTicket
} = require("../controllers/clases-ticket");

const router = Router();

router.use(validarJWT);

router.get("/", getClasesTickets);
router.get("/:id", getClaseTicketById);

router.post("/", [
    check('codigoClase', 'El código es obligatorio').not().isEmpty(),
    check('claseTicket', 'El nombre de la clase es obligatorio').not().isEmpty(),
    validarCampos
], createClaseTicket);

router.put("/:id", [
    validarCampos
], updateClaseTicket);

router.delete("/:id", deleteClaseTicket);

module.exports = router;