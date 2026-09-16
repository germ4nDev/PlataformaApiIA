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
} = require("../controllers/colores-settings");

const router = Router();

// router.use(validarJWT);
// router.use(validarSesion);

router.get("/", getColoresSettings);

router.get("/:id", getColorSettingById);

router.post("/", [validarJWT, validarSesion], createColorSetting);

router.put("/:id", [validarJWT, validarSesion], updateColorSetting);

router.delete("/:id", [validarJWT, validarSesion], deleteColorSetting);

module.exports = router;