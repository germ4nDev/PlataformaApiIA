const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getColoresSettings,
    getColorSettingById,
    createColorSetting,
    updateColorSetting,
    deleteColorSetting
} = require("../controllers/colores-settings");

const router = Router();

router.use(validarJWT);

router.get("/", getColoresSettings);
router.get("/:id", getColorSettingById);

router.post("/", [
    check('colorNav', 'El color principal es obligatorio').not().isEmpty(),
    validarCampos
], createColorSetting);

router.put("/:id", [
    validarCampos
], updateColorSetting);

router.delete("/:id", deleteColorSetting);

module.exports = router;