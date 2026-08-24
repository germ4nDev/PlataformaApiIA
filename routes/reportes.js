/*
    Author: German Valencia
    Ruta: /api/suscriptores
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { generarReportePdf } = require("../controllers/reportes");

const router = Router();

router.post("/generar", [validarJWT], generarReportePdf);

module.exports = router;