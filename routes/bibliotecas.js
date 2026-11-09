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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();
// router.use(validarSesion);

router.get("/", getBibliotecas);

router.get("/:id", validarJWT, getBibliotecaByCode);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_BBT_CREAR')], createBiblioteca);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_BBT_MODIFICAR')], updateBiblioteca);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_BBT_ELIMINAR')], deleteBiblioteca);


module.exports = router;