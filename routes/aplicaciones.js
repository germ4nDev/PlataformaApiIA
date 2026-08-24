/*
    Author: German Valencia
    Ruta: /api/aplicaciones
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getAplicaciones,
    getAplicacionByCode,
    createAplicacion,
    updateAplicacion,
    deleteAplicacion,
} = require("../controllers/aplicaciones");

const router = Router();

router.get("/", validarJWT, getAplicaciones);

router.get("/:code", validarJWT, getAplicacionByCode);

router.post("/", [
    check('codigoAplicacion', 'El código de la aplicacion es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], createAplicacion);

router.put("/:id", [
    validarJWT,
    validarCampos
], updateAplicacion);

router.delete("/:id", validarJWT, deleteAplicacion);

module.exports = router;