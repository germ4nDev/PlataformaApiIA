/*
    Author: German Valencia
    Ruta: /api/logs-actividades
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { getLogs, getLogById, createLog } = require("../controllers/logs-actividades");

const router = Router();

router.use(validarJWT);

router.get("/", getLogs);
router.get("/:id", getLogById);

router.post("/", [
    check('actividad', 'La descripción de la actividad es obligatoria').not().isEmpty(),
    check('modulo', 'El módulo es obligatorio').not().isEmpty(),
    validarCampos
], createLog);

// NOTA: No se exponen rutas PUT ni DELETE para mantener la integridad de la auditoría.

module.exports = router;