/*
    Author: German Valencia
    Ruta: /api/usuarios-roles
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getModulos,
    getModuloById,
    createModulo,
    updateModulo,
    deleteModulo
} = require("../controllers/modulos-ap");

const router = Router();

// router.use(validarJWT);

router.get("/", getModulos);
router.get("/:id", validarJWT, getModuloById);

router.post("/", [
    check('codigoModulo', 'El código es obligatorio').not().isEmpty(),
    check('nombreModulo', 'El nombre es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], createModulo);

router.put("/:id", [
    validarJWT,
    validarCampos
], updateModulo);

router.delete("/:id", validarJWT, deleteModulo);

module.exports = router;