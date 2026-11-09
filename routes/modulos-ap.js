/*
    Author: German Valencia
    Ruta: /api/usuarios-roles
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getModulos,
    getModuloById,
    createModulo,
    updateModulo,
    deleteModulo
} = require("../controllers/modulos-ap");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getModulos);

router.get("/:id", validarJWT, getModuloById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_MODULOS_CREAR')], createModulo);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_MODULOS_MODIFICAR')], updateModulo);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_MODULOS_ELIMINAR')], deleteModulo);

module.exports = router;