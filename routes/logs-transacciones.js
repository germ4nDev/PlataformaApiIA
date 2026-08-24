/*
    Author: German Valencia
    Ruta: /api/logs-transacciones
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { getLogs, getLogById, createLog } = require("../controllers/logs-transacciones");

const router = Router();

router.use(validarJWT);

router.get("/", getLogs);
router.get("/:id", getLogById);

router.post("/", [
    check('tipoTransaccion', 'El tipo de transacción es obligatorio').not().isEmpty(),
    check('monto', 'El monto debe ser un valor numérico').optional().isNumeric(),
    validarCampos
], createLog);

module.exports = router;