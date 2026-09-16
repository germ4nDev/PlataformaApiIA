/*
    Author: German Valencia
    Ruta: /api/logs-actualizaviones
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { getLogs, getLogById, createLog } = require("../controllers/logs-actualizaciones");
const { validarSesion } = require("../middlewares/validar-sesion");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getLogs);

router.get("/:id", getLogById);

router.post("/", [validarJWT, validarSesion], createLog);

// Por seguridad, no se definen rutas para actualizar ni eliminar logs.

module.exports = router;