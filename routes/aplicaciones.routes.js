/*
    Author: German Valencia
    Ruta: /api/aplicaciones
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getAplicaciones,
    getAplicacionByCode,
    createAplicacion,
    updateAplicacion,
    deleteAplicacion,
} = require("../controllers/aplicaciones.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();
// router.use(validarSesion);

router.get("/", getAplicaciones);

router.get("/:code", getAplicacionByCode);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_APP_CREAR')], createAplicacion);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_APP_MODIFICAR')], updateAplicacion);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_APP_ELIMINAR')], deleteAplicacion);

module.exports = router;