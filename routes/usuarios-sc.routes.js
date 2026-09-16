/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/usuarios-sc
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getUsuariosSC,
    getUsuarioSCById,
    getUsuariosSCBySuscriptorCode,
    uploadMasivoUsuariosSC,
    createUsuarioSC,
    updateUsuarioSC,
    deleteUsuarioSC
} = require("../controllers/usuarios-sc.controller");

const router = Router();

//router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getUsuariosSC);

router.get("/:id", getUsuarioSCById);

router.get("/suscriptor/:codigoSuscriptor", getUsuariosSCBySuscriptorCode);

router.post('/cargue-masivo', [validarJWT, validarSesion], uploadMasivoUsuariosSC);

router.post("/", [validarJWT, validarSesion], createUsuarioSC);

router.put("/:id", [validarJWT, validarSesion], updateUsuarioSC);

router.delete("/:id", [validarJWT, validarSesion], deleteUsuarioSC);

module.exports = router;