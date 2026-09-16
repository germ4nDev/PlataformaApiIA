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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getRequerimientos);

router.get("/:id", getRequerimientoById);

router.post("/", [validarJWT, validarSesion], createRequerimiento);

router.put("/:id", [validarJWT, validarSesion], updateRequerimiento);

router.delete("/:id", [validarJWT, validarSesion], deleteRequerimiento);

module.exports = router;