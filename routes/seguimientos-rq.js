/*
    Author: German Valencia
    Actualización: John Castañeda
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getSeguimientos,
    getSeguimientoById,
    getSeguimientosByTicket,
    createSeguimiento,
    updateSeguimiento,
    deleteSeguimiento
} = require("../controllers/seguimientos-rq");

const router = Router();

// router.use(validarJWT);

router.get("/", getSeguimientos);

router.get("/:id", validarJWT, getSeguimientoById);

router.get("/ticket/:ticketId", validarJWT, getSeguimientosByTicket);

router.post("/", [
    check('codigoTicket', 'El código de ticket es obligatorio').not().isEmpty(),
    check('observacion', 'La observación es obligatoria').not().isEmpty(),
    validarJWT,
    validarCampos
], createSeguimiento);

router.put("/:id", [
    validarJWT,
    validarCampos
], updateSeguimiento);

router.delete("/:id", validarJWT, deleteSeguimiento);

module.exports = router;