/*
    Author: Juan Valencia
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getTiposScripts,
    getTipoScriptById,
    createTipoScript,
    updateTipoScript,
    deleteTipoScript
} = require("../controllers/tipos-scripts");

const router = Router();

router.use(validarJWT);

router.get("/", getTiposScripts);
router.get("/:id", getTipoScriptById);

router.post("/", [
    check('nombreTipo', 'El nombre del tipo es obligatorio').not().isEmpty(),
    validarCampos
], createTipoScript);

router.put("/:id", [
    validarCampos
], updateTipoScript);

router.delete("/:id", deleteTipoScript);

module.exports = router;