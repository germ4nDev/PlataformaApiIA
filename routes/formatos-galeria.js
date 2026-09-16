/*
    Author: German Valencia
    Ruta: /api/clasesTcket
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getFormatosGaleria,
    getFormatoGaleriaById,
    createFormatoGaleria,
    updateFormatoGaleria,
    deleteFormatoGaleria
} = require("../controllers/formatos-galeria");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getFormatosGaleria);

router.get("/:id", getFormatoGaleriaById);

router.post("/", [validarJWT, validarSesion], createFormatoGaleria);

router.put("/:id", [validarJWT, validarSesion], updateFormatoGaleria);

router.delete("/:id", [validarJWT, validarSesion], validarJWT, deleteFormatoGaleria);

module.exports = router;