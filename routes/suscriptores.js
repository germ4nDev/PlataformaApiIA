/*
    Author: German Valencia
    Ruta: /api/suscriptores
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getSuscriptores,
    getSuscriptorById,
    createSuscriptor,
    updateSuscriptor,
    deleteSuscriptor
} = require("../controllers/suscriptores");

const router = Router();

// router.use(validarJWT);

router.get("/", getSuscriptores);

router.get("/:id", validarJWT, getSuscriptorById);

router.post("/", [
    // check('nombreSuscriptor', 'El nombre es obligatorio').not().isEmpty(),
    // check('identificacionSuscriptor', 'La identificación es obligatoria').not().isEmpty(),
    // validarJWT,
    // validarCampos
], createSuscriptor);

router.put("/:id", [
    // validarJWT,
    // validarCampos
], updateSuscriptor);

router.delete("/:id", validarJWT, deleteSuscriptor);

module.exports = router;