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
const { validarPermiso } = require('../middlewares/validar-permiso');
const { validarJWT } = require('../middlewares/validar-jwt');
const { validarSesion } = require('../middlewares/validar-sesion');

const router = Router();
// router.use(validarSesion);

router.get("/", getSliders);

router.get("/:id", getSliderById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_SLIDER_CREAR')], createSlider);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SLIDER_MODIFICAR')], updateSlider);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SLIDER_ELIMINAR')], deleteSlider);

module.exports = router;