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
    createUsuarioSC,
    updateUsuarioSC,
    deleteUsuarioSC
} = require("../controllers/usuarios-sc");

const router = Router();

// router.use(validarJWT);

router.get("/", getUsuariosSC);

router.get("/:id", validarJWT, getUsuarioSCById);

router.get("/suscriptor/:codigoSuscriptor", validarJWT, getUsuariosSCBySuscriptorCode);

router.post("/", [
    check('codigoUsuarioSC', 'El código de usuario es obligatorio').not().isEmpty(),
    check('codigoUsuario', 'El código de usuario es obligatorio').not().isEmpty(),
    check('codigoSuscriptor', 'El código de suscriptor es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], createUsuarioSC);

router.put("/:id", [
    check('codigoUsuario', 'El código de usuario es obligatorio').not().isEmpty(),
    check('codigoSuscriptor', 'El código de suscriptor es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], updateUsuarioSC);

router.delete("/:id", validarJWT, deleteUsuarioSC);

module.exports = router;