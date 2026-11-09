/*
    Author: German Valencia
    Ruta: /api/usuarios-empresas
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getUsuariosEmpresas,
    getUsuarioEmpresaById,
    createUsuarioEmpresa,
    updateUsuarioEmpresa,
    deleteUsuarioEmpresa
} = require("../controllers/usuarios-empresas-sc.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getUsuariosEmpresas);

router.get("/:id", getUsuarioEmpresaById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_USUSC_EMPRESAS')], createUsuarioEmpresa);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_USUSC_EMPRESAS')], updateUsuarioEmpresa);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_USUSC_EMPRESAS')], deleteUsuarioEmpresa);

module.exports = router;