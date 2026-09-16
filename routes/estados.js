/*
    Author: John Castañeda
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getEstados,
    getEstadoById,
    createEstado,
    updateEstado,
    deleteEstado
} = require("../controllers/estados");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getEstados);

router.get("/:id", getEstadoById);

router.post("/", [validarJWT, validarSesion], createEstado);

router.put("/:id", [validarJWT, validarSesion], updateEstado);

router.delete("/:id", [validarJWT, validarSesion], deleteEstado);

module.exports = router;