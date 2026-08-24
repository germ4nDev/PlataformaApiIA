/*
    Author: John Castañeda
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getEstados,
    getEstadoById,
    createEstado,
    updateEstado,
    deleteEstado
} = require("../controllers/estados");

const router = Router();

router.use(validarJWT);

router.get("/", getEstados);
router.get("/:id", getEstadoById);

router.post("/", [
    check('nombreEstado', 'El nombre del estado es obligatorio').not().isEmpty(),
    validarCampos
], createEstado);

router.put("/:id", [
    validarCampos
], updateEstado);

router.delete("/:id", deleteEstado);

module.exports = router;