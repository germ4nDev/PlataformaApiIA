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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

//router.use(validarJWT);
// router.use(validarSesion);

router.get("/", getClasesTickets);

router.get("/:id", getClaseTicketById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_CLASESTK_CREAR')], createClaseTicket);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_CLASESTK_MODIFICAR')], updateClaseTicket);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_CLASESTK_ELIMINAR')], deleteClaseTicket);

module.exports = router;