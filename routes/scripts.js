/*
    Author: Juan Valencia
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getScripts,
    getScriptById,
    createScript,
    updateScript,
    deleteScript
} = require("../controllers/scripts");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getScripts);

router.get("/:id", getScriptById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_SCRIPTS_CREAR')], createScript);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SCRIPTS_MODIFICAR')], updateScript);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SCRIPTS_ELIMINAR')], deleteScript);

module.exports = router;