/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/usuarios-sc
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");

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

// router.use(validarJWT);

router.get("/", getUsuariosSC);

router.get("/:id", getUsuarioSCById);

router.get("/suscriptor/:codigoSuscriptor", validarJWT, getUsuariosSCBySuscriptorCode);

router.post('/cargue-masivo', uploadMasivoUsuariosSC);

router.post("/", createUsuarioSC);

router.put("/:id", updateUsuarioSC);

router.delete("/:id", deleteUsuarioSC);

module.exports = router;