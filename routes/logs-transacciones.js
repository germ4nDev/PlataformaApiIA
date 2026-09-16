/*
    Author: German Valencia
    Ruta: /api/logs-transacciones
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { getLogs, getLogById, createLog } = require("../controllers/logs-transacciones");
const { validarSesion } = require("../middlewares/validar-sesion");

const router = Router();

/// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getLogs);

router.get("/:id", getLogById);

router.post("/", [validarJWT, validarSesion], createLog);

module.exports = router;