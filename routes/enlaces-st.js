/*
    Author: German Valencia
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getEnlaces,
    getEnlaceById,
    createEnlace,
    updateEnlace,
    deleteEnlace
} = require("../controllers/enlaces-st");

const router = Router();

router.use(validarJWT);

router.get("/", getEnlaces);
router.get("/:id", getEnlaceById);

router.post("/", [
    check('nombreEnlace', 'El nombre del enlace es obligatorio').not().isEmpty(),
    check('urlEnlace', 'La URL es obligatoria').not().isEmpty(),
    validarCampos
], createEnlace);

router.put("/:id", [
    validarCampos
], updateEnlace);

router.delete("/:id", deleteEnlace);

module.exports = router;