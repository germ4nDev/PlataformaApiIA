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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

//router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getUsuariosSC);

router.get("/:id", getUsuarioSCById);

router.get("/suscriptor/:codigoSuscriptor", getUsuariosSCBySuscriptorCode);

router.post('/cargue-masivo', [validarJWT, validarSesion, validarPermiso('ACT_USUSC_CARGUE')], uploadMasivoUsuariosSC);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_USUSC_CREAR')], createUsuarioSC);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_USUSC_CAMBIAR')], updateUsuarioSC);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_USUSC_ELIMINAR')], deleteUsuarioSC);

module.exports = router;