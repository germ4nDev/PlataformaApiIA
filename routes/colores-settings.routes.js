/*
    Author: German Valencia
    Ruta: /api/aplicaciones
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getColoresSettings,
    getColorSettingById,
    createColorSetting,
    updateColorSetting,
    deleteColorSetting
} = require("../controllers/colores-settings.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarJWT);
// router.use(validarSesion);

router.get("/", getColoresSettings);

router.get("/:id", getColorSettingById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_COLORES_CREAR')], createColorSetting);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_COLORES_MODIFICAR')], updateColorSetting);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_COLORES_ELIMINAR')], deleteColorSetting);

module.exports = router;