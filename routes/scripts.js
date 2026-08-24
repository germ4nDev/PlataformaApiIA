/*
    Author: Juan Valencia
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getScripts,
    getScriptById,
    createScript,
    updateScript,
    deleteScript
} = require("../controllers/scripts");

const router = Router();

router.use(validarJWT);

router.get("/", getScripts);
router.get("/:id", getScriptById);

router.post("/", [
    check('nombreScript', 'El nombre es obligatorio').not().isEmpty(),
    check('contenidoScript', 'El contenido del script es obligatorio').not().isEmpty(),
    validarCampos
], createScript);

router.put("/:id", [
    validarCampos
], updateScript);

router.delete("/:id", deleteScript);

module.exports = router;