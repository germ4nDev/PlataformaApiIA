/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/versiones-ap
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");

const {
    getVersionesAP,
    getVersionAPById,
    createVersionAP,
    updateVersionAP,
    deleteVersionAP
} = require("../controllers/versiones-ap");

const router = Router();

router.use(validarJWT);

router.get("/", getVersionesAP);
router.get("/:id", getVersionAPById);

router.post("/", [
    check('nombreVersion', 'El nombre de la versión es obligatorio').not().isEmpty(),
    validarCampos
], createVersionAP);

router.put("/:id", [
    validarCampos
], updateVersionAP);

router.delete("/:id", deleteVersionAP);

module.exports = router;