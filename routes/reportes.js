/*
    Author: German Valencia
    Ruta: /api/suscriptores
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { generarReportePdf } = require("../controllers/reportes");
const { validarSesion } = require("../middlewares/validar-sesion");

const router = Router();
// router.use(validarSesion);

router.post("/generar", [validarJWT, validarSesion], generarReportePdf);

module.exports = router;