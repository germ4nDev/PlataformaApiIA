/*
    Author: German Valencia
    Ruta: /api/clasesTcket
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getBibliotecas,
    getBibliotecaByCode,
    createBiblioteca,
    updateBiblioteca,
    deleteBiblioteca,
} = require("../controllers/bibliotecas");

const router = Router();

router.get("/", getBibliotecas);

router.get("/:id", validarJWT, getBibliotecaByCode);

router.post("/", [
    check('codigoBiblioteca', 'El código de la biblioteca es obligatorio').not().isEmpty(),
    check('codigoAplicacion', 'El código de la aplicacion es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], createBiblioteca);

router.put("/:id", [
    check('codigoAplicacion', 'El código de la aplicacion es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], updateBiblioteca);

router.delete("/:id", validarJWT, deleteBiblioteca);


module.exports = router;