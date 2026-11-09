/*
    Author: German Valencia
    Actualización: John Castañeda
    Ruta: /api/requerimientos
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getRequerimientos,
    getRequerimientoById,
    createRequerimiento,
    updateRequerimiento,
    deleteRequerimiento
} = require("../controllers/requerimientos-tk");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getRequerimientos);

router.get("/:id", getRequerimientoById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_REQUERIMIENTOS_CREAR')], createRequerimiento);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_REQUERIMIENTOS_MODIFICAR')], updateRequerimiento);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_REQUERIMIENTOS_ELIMINAR')], deleteRequerimiento);

module.exports = router;