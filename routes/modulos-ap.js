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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getModulos);

router.get("/:id", validarJWT, getModuloById);

router.post("/", [validarJWT, validarSesion], createModulo);

router.put("/:id", [validarJWT, validarSesion], updateModulo);

router.delete("/:id", [validarJWT, validarSesion], deleteModulo);

module.exports = router;