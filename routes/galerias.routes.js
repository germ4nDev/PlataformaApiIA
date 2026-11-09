/*
    Author: German Valencia
    Ruta: /api/clasesTcket
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getGalerias,
    getGaleriaById,
    createGaleria,
    updateGaleria,
    deleteGaleria
} = require("../controllers/galerias");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getGalerias);

router.get("/:id", getGaleriaById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_GALERIAS_CREAR')], createGaleria);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_GALERIAS_MODIFICAR')], updateGaleria);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_GALERIAS_ELIMINAR')], deleteGaleria);

module.exports = router;
