/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/versiones-ap
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getVersionesAP,
    getVersionAPById,
    createVersionAP,
    updateVersionAP,
    deleteVersionAP
} = require("../controllers/versiones-ap.controller");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getVersionesAP);

router.get("/:id", getVersionAPById);

router.post("/", [validarJWT, validarSesion], createVersionAP);

router.put("/:id", [validarJWT, validarSesion], updateVersionAP);

router.delete("/:id", [validarJWT, validarSesion], deleteVersionAP);

module.exports = router;