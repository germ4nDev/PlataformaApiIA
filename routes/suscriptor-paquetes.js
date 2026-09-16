/*
    Author: German Valencia
    Ruta: /api/suscriptores-paquetes
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getSuscriptoresPaquetes,
    getSuscriptoresPaquetesById,
    createSuscriptorPaquete,
    updateSuscriptorPaquete,
    deleteSuscriptorPaquete,
} = require("../controllers/suscriptor-paquetes");

const router = Router();
// router.use(validarSesion);

router.get("/", getSuscriptoresPaquetes);

router.get("/:id", getSuscriptoresPaquetesById);

router.post("/", [validarJWT, validarSesion], createSuscriptorPaquete);

router.put("/:id", [validarJWT, validarSesion], updateSuscriptorPaquete);

router.delete("/:id", [validarJWT, validarSesion], deleteSuscriptorPaquete);

module.exports = router;