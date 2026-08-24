/*
    Author: German Valencia
    Ruta: /api/clasesTcket
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getGalerias,
    getGaleriaById,
    createGaleria,
    updateGaleria,
    deleteGaleria
} = require("../controllers/galerias");

const router = Router();

// router.use(validarJWT);

router.get("/", getGalerias);

router.get("/:id", validarJWT, getGaleriaById);

router.post("/", [
    check('nombreGaleria', 'El nombre es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], createGaleria);

router.put("/:id", [
    validarJWT,
    validarCampos
], updateGaleria);

router.delete("/:id", validarJWT, deleteGaleria);

module.exports = router;
