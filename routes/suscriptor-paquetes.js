/*
    Author: German Valencia
    Ruta: /api/suscriptores-paquetes
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getSuscriptoresPaquetes,
    getSuscriptoresPaquetesById,
    createSuscriptorPaquete,
    updateSuscriptorPaquete,
    deleteSuscriptorPaquete,
} = require("../controllers/suscriptor-paquetes");

const router = Router();

router.get("/", validarJWT, getSuscriptoresPaquetes);

router.get("/:id", validarJWT, getSuscriptoresPaquetesById);

router.post("/", validarJWT, createSuscriptorPaquete);

router.put("/:id", validarJWT, updateSuscriptorPaquete);

router.delete("/:id", validarJWT, deleteSuscriptorPaquete);

module.exports = router;