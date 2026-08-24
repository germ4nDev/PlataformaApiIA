/*
    Author: German Valencia
    Actualización: John Castañeda
    Ruta: /api/requerimientos
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getRequerimientos,
    getRequerimientoById,
    createRequerimiento,
    updateRequerimiento,
    deleteRequerimiento
} = require("../controllers/requerimientos-tk");

const router = Router();

router.use(validarJWT);

router.get("/", getRequerimientos);
router.get("/:id", getRequerimientoById);

router.post("/", [
    check('nombreRequerimiento', 'El nombre es obligatorio').not().isEmpty(),
    validarCampos
], createRequerimiento);

router.put("/:id", [
    validarCampos
], updateRequerimiento);

router.delete("/:id", deleteRequerimiento);

module.exports = router;