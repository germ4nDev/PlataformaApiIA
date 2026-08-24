/*
    Author: German Valencia

    Ruta: /api/slidersInicio
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getSliders,
    getSliderById,
    createSlider,
    updateSlider,
    deleteSlider
} = require("../controllers/sliders-inicio");

const router = Router();

router.get("/", getSliders);

router.get("/:id", [validarJWT], getSliderById);

router.post("/", [validarJWT], createSlider);

router.put("/:id", [validarJWT], updateSlider);

router.delete("/:id", [validarJWT], deleteSlider);

module.exports = router;