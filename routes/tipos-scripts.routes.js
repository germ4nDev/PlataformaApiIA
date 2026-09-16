/*
    Author: Juan Valencia
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getTiposScripts,
    getTipoScriptById,
    createTipoScript,
    updateTipoScript,
    deleteTipoScript
} = require("../controllers/tipos-scripts.controller");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposScripts);

router.get("/:id", getTipoScriptById);

router.post("/", [validarJWT, validarSesion], createTipoScript);

router.put("/:id", [validarJWT, validarSesion], updateTipoScript);

router.delete("/:id", [validarJWT, validarSesion], deleteTipoScript);

module.exports = router;