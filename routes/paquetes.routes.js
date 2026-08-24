/*
    Author: German Valencia
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
} = require("../controllers/paquetes.controller");

const router = Router();

// router.use(validarJWT);

router.get("/", getPaquetes);
router.get("/:id", getPaqueteById);

router.post("/", [
    check('codigoPaquete', 'El código es obligatorio').not().isEmpty(),
    check('nombrePaquete', 'El nombre es obligatorio').not().isEmpty(),
    validarCampos
], createPaquete);

router.put("/:id", [
    validarCampos
], updatePaquete);

router.delete("/:id", deletePaquete);

module.exports = router;