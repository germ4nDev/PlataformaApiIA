/*
    Author: German Valencia

    Ruta: /api/slidersInicio
*/
const { Router } = require("express");
// const { validarJWT } = require("../middlewares/validar-jwt");
// const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getSliders,
    getSliderById,
    createSlider,
    updateSlider,
    deleteSlider
} = require("../controllers/sliders-inicio");

const router = Router();
// router.use(validarSesion);

router.get("/", getSliders);

router.get("/:id", getSliderById);

router.post("/", createSlider);

router.put("/:id", updateSlider);

router.delete("/:id", deleteSlider);

module.exports = router;