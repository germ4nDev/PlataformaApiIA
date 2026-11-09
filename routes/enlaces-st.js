/*
    Author: German Valencia
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getEnlaces,
    getEnlaceById,
    createEnlace,
    updateEnlace,
    deleteEnlace
} = require("../controllers/enlaces-st");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();
//router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getEnlaces);

router.get("/:id", getEnlaceById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_ENLACES_CREAR')], createEnlace);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ENLACES_MODIFICAR')], updateEnlace);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ENLACES_ELIMINAR')], deleteEnlace);

module.exports = router;