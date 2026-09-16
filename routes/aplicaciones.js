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
} = require("../controllers/aplicaciones");

const router = Router();
// router.use(validarSesion);

router.get("/", getAplicaciones);

router.get("/:code", getAplicacionByCode);

router.post("/", [validarJWT, validarSesion], createAplicacion);

router.put("/:id", [validarJWT, validarSesion], updateAplicacion);

router.delete("/:id", [validarJWT, validarSesion], deleteAplicacion);

module.exports = router;