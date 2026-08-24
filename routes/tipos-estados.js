/*
    Author: John Castañeda
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getTiposEstados,
    getTipoEstadoById,
    createTipoEstado,
    updateTipoEstado,
    deleteTipoEstado
} = require("../controllers/tipos-estados");

const router = Router();

router.use(validarJWT);

router.get("/", getTiposEstados);
router.get("/:id", getTipoEstadoById);

router.post("/", [
    check('nombreTipo', 'El nombre del tipo es obligatorio').not().isEmpty(),
    validarCampos
], createTipoEstado);

router.put("/:id", [
    validarCampos
], updateTipoEstado);

router.delete("/:id", deleteTipoEstado);

module.exports = router;