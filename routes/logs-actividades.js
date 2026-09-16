/*
    Author: German Valencia
    Ruta: /api/logs-actividades
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { getLogs, getLogById, createLog } = require("../controllers/logs-actividades");
const { validarSesion } = require("../middlewares/validar-sesion");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getLogs);

router.get("/:id", getLogById);

router.post("/", [validarJWT, validarSesion], createLog);

// NOTA: No se exponen rutas PUT ni DELETE para mantener la integridad de la auditoría.

module.exports = router;