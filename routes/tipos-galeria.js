/*
    Author: German Valencia
    Ruta: /api/clasesTcket
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getTiposGaleria,
    getTipoGaleriaById,
    createTipoGaleria,
    updateTipoGaleria,
    deleteTipoGaleria
} = require("../controllers/tipos-galeria");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposGaleria);

router.get("/:id", getTipoGaleriaById);

router.post("/", [validarJWT, validarSesion], createTipoGaleria);

router.put("/:id", [validarJWT, validarSesion], updateTipoGaleria);

router.delete("/:id", [validarJWT, validarSesion], deleteTipoGaleria);

module.exports = router;