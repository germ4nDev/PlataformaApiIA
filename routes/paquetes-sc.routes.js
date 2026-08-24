/*
    Author: German Valencia
    Actualización: John Castañeda
    Ruta: /api/suscriptores
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getPaquetes,
    getPaqueteById,
    createPaquete,
    updatePaquete,
    deletePaquete
} = require("../controllers/paquetes-sc.controller");

const router = Router();

// router.use(validarJWT);

router.get("/", getPaquetes);
router.get("/:id", getPaqueteById);
router.post("/", createPaquete);

// router.post("/", [
//     check('codigoPaquete', 'El código del paquete es obligatorio').not().isEmpty(),
//     check('codigoSuscriptor', 'El código del suscriptor es obligatorio').not().isEmpty(),
//     validarCampos
// ], createPaquete);

router.put("/:id", [
    validarCampos
], updatePaquete);

router.delete("/:id", deletePaquete);

module.exports = router;