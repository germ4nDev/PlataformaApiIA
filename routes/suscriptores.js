/*
    Author: German Valencia
    Ruta: /api/suscriptores
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getSuscriptores,
    getSuscriptorById,
    createSuscriptor,
    updateSuscriptor,
    deleteSuscriptor
} = require("../controllers/suscriptores");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getSuscriptores);

router.get("/:id", [validarJWT, validarSesion], getSuscriptorById);

router.post("/", [validarJWT, validarSesion], createSuscriptor);

router.put("/:id", [validarJWT, validarSesion], updateSuscriptor);

router.delete("/:id", [validarJWT, validarSesion], deleteSuscriptor);

module.exports = router;