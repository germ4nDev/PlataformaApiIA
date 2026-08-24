/*
    Author: German Valencia
    Ruta: /api/usuarios-empresas
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getUsuariosEmpresas,
    getUsuarioEmpresaById,
    createUsuarioEmpresa,
    updateUsuarioEmpresa,
    deleteUsuarioEmpresa
} = require("../controllers/usuarios-empresas-sc");

const router = Router();

// router.use(validarJWT);

router.get("/", getUsuariosEmpresas);

router.get("/:id", validarJWT, getUsuarioEmpresaById);

router.post("/", [
    check('codigoUsuario', 'El código de usuario es obligatorio').not().isEmpty(),
    check('codigoSuscriptor', 'El código de suscriptor es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], createUsuarioEmpresa);

router.put("/:id", [
    validarJWT,
    validarCampos
], updateUsuarioEmpresa);

router.delete("/:id", validarJWT, deleteUsuarioEmpresa);

module.exports = router;