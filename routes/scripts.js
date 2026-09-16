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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getScripts);

router.get("/:id", getScriptById);

router.post("/", [validarJWT, validarSesion], createScript);

router.put("/:id", [validarJWT, validarSesion], updateScript);

router.delete("/:id", [validarJWT, validarSesion], deleteScript);

module.exports = router;