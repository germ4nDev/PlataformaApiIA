/*
    Author: German Valencia
    Ruta: /api/clasesTcket
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getBibliotecas,
    getBibliotecaByCode,
    createBiblioteca,
    updateBiblioteca,
    deleteBiblioteca,
} = require("../controllers/bibliotecas");

const router = Router();
// router.use(validarSesion);

router.get("/", getBibliotecas);

router.get("/:id", validarJWT, getBibliotecaByCode);

router.post("/", [validarJWT, validarSesion], createBiblioteca);

router.put("/:id", [validarJWT, validarSesion], updateBiblioteca);

router.delete("/:id", [validarJWT, validarSesion], deleteBiblioteca);


module.exports = router;