/*
    Author: German Valencia
    Ruta: /api/clasesTcket
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getFormatosGaleria,
    getFormatoGaleriaById,
    createFormatoGaleria,
    updateFormatoGaleria,
    deleteFormatoGaleria
} = require("../controllers/formatos-galeria");

const router = Router();

// router.use(validarJWT);

router.get("/", getFormatosGaleria);

router.get("/:id", validarJWT, getFormatoGaleriaById);

router.post("/", [
    check('nombreFormato', 'El nombre del formato es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], createFormatoGaleria);

router.put("/:id", [
    validarJWT,
    validarCampos
], updateFormatoGaleria);

router.delete("/:id", validarJWT, deleteFormatoGaleria);

module.exports = router;