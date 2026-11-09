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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposScripts);

router.get("/:id", getTipoScriptById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSSCRIPT_CREAR')], createTipoScript);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSSCRIPT_MODIFICAR')], updateTipoScript);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSSCRIPT_ELIMINAR')], deleteTipoScript);

module.exports = router;