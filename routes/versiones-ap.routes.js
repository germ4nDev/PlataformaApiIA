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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getVersionesAP);

router.get("/:id", getVersionAPById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_VERSIONES_CREAR')], createVersionAP);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_VERSIONES_MODIFICAR')], updateVersionAP);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_VERSIONES_ELIMINAR')], deleteVersionAP);

module.exports = router;