const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getClasesTickets,
    getClaseTicketById,
    createClaseTicket,
    updateClaseTicket,
    deleteClaseTicket
} = require("../controllers/clases-ticket");

const router = Router();

//router.use(validarJWT);
// router.use(validarSesion);

router.get("/", getClasesTickets);

router.get("/:id", getClaseTicketById);

router.post("/", [validarJWT, validarSesion], createClaseTicket);

router.put("/:id", [validarJWT, validarSesion], updateClaseTicket);

router.delete("/:id", [validarJWT, validarSesion], deleteClaseTicket);

module.exports = router;