/*
    Author: German Valencia
    Ruta: /api/clasesTcket
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getTiposGaleria,
    getTipoGaleriaById,
    createTipoGaleria,
    updateTipoGaleria,
    deleteTipoGaleria
} = require("../controllers/tipos-galeria");

const router = Router();

router.use(validarJWT);

router.get("/", getTiposGaleria);
router.get("/:id", getTipoGaleriaById);

router.post("/", [
    check('nombreTipo', 'El nombre del tipo es obligatorio').not().isEmpty(),
    validarCampos
], createTipoGaleria);

router.put("/:id", [
    validarCampos
], updateTipoGaleria);

router.delete("/:id", deleteTipoGaleria);

module.exports = router;